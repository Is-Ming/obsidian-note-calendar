import { App, Notice, TFile } from 'obsidian';

/**
 * Templater 集成模块（可选依赖，运行时探测）
 *
 * 设计原则（见 docs/Templater集成技术分析.md）：
 * - 未安装/未启用 Templater 时所有函数静默返回，对现有功能零影响
 * - 只通过 app.plugins.plugins["templater-obsidian"] 访问内部 API，不引入构建期依赖
 * - 全链路防御：实例探测 → 能力检测（typeof）→ 模板文件校验 → 冲突检测 → try/catch
 * - 渲染失败时保留空笔记（用户输入的标题不丢失），仅 Notice 提示
 */

/** RunMode.CreateNewFromTemplate（数值枚举，已核对 1.16.0 / 2.0.0 / master 一致） */
const RUN_MODE_CREATE_NEW_FROM_TEMPLATE = 0;

/**
 * Templater 内部运行配置对象（鸭子类型，字段全部按 unknown 处理）
 */
interface TemplaterRunningConfig {
  template_file?: unknown;
  target_file?: unknown;
  run_mode?: unknown;
  frontmatter?: unknown;
}

/**
 * Templater 核心对象（templater-obsidian 插件的 .templater 属性）
 * 所有方法声明为可选，任何字段缺失都不会崩溃
 */
interface TemplaterLike {
  create_running_config?: (
    templateFile: TFile,
    targetFile: TFile,
    runMode: number
  ) => TemplaterRunningConfig;
  read_and_parse_template?: (config: TemplaterRunningConfig) => Promise<string>;
}

/**
 * templater-obsidian 插件实例（鸭子类型）
 * settings 字段用于冲突检测（folder 模式双重套用防护）
 */
interface TemplaterPluginLike {
  templater?: TemplaterLike;
  settings?: {
    trigger_on_file_creation?: boolean;
    trigger_on_file_creation_mode?: 'none' | 'folder' | 'regex';
    folder_templates?: Array<{ folder: string; template: string }>;
    ignore_folders_on_creation?: Array<{ folder: string }>;
  };
}

/**
 * 获取 templater-obsidian 插件实例（未安装/未启用返回 undefined）
 */
export function getTemplaterPlugin(app: App): TemplaterPluginLike | undefined {
  // app.plugins 不在官方类型声明中，经结构化断言访问（避免 any）
  const plugins = (app as unknown as { plugins?: { plugins?: Record<string, unknown> } }).plugins;
  return plugins?.plugins?.['templater-obsidian'] as TemplaterPluginLike | undefined;
}

/**
 * Templater 是否可用（已安装且内部 API 结构完整）
 */
export function isTemplaterAvailable(app: App): boolean {
  const plugin = getTemplaterPlugin(app);
  return !!plugin?.templater
    && typeof plugin.templater.create_running_config === 'function'
    && typeof plugin.templater.read_and_parse_template === 'function';
}

/**
 * 冲突检测：Templater 的"文件夹模板"是否会命中目标文件所在目录
 * 命中时 Templater 的 on-create 触发会自动套模板，我方应跳过，避免双重套用
 * （初版仅检测 folder 模式；regex 模式在设置描述与 README 中提示避免混用）
 */
function templaterFolderTemplateWillMatch(
  plugin: TemplaterPluginLike,
  file: TFile
): boolean {
  const s = plugin.settings;
  if (!s?.trigger_on_file_creation) return false;
  if (s.trigger_on_file_creation_mode !== 'folder') return false;

  const folder = file.parent?.path ?? '/';
  const ignored =
    s.ignore_folders_on_creation?.some((i) => i.folder === folder) ?? false;
  if (ignored) return false;

  return s.folder_templates?.some((f) => f.folder === folder) ?? false;
}

/**
 * 等待文件 mtime 稳定（防竞态：创建后立即写入可能与 Templater 的
 * on-create 异步处理互相覆盖）。轮询间隔指数退避 30ms→200ms，超时即放行。
 */
async function waitForFileSettle(app: App, file: TFile, timeoutMs = 600): Promise<void> {
  const startTime = Date.now();
  let interval = 30;
  let lastMtime: number | null = null;

  while (Date.now() - startTime < timeoutMs) {
    let mtime: number | null = null;
    try {
      const stat = await app.vault.adapter.stat(file.path);
      mtime = stat?.mtime ?? null;
    } catch {
      return; // stat 不可用时放弃等待，直接放行（非致命）
    }
    if (lastMtime !== null && mtime === lastMtime) {
      return; // mtime 已稳定
    }
    lastMtime = mtime;
    await new Promise((r) => setTimeout(r, interval));
    interval = Math.min(interval * 2, 200);
  }
}

/**
 * 为已创建的笔记套用 Templater 模板
 *
 * @param app 主窗口 App 实例（插件本体所在窗口）
 * @param noteFile 刚创建的目标笔记文件
 * @param templatePath 用户配置的模板文件路径
 * @returns 是否实际执行了模板渲染（false = 跳过/降级，笔记保持原状）
 */
export async function applyTemplater(
  app: App,
  noteFile: TFile,
  templatePath: string
): Promise<boolean> {
  const templatePathTrimmed = templatePath.trim();
  if (!templatePathTrimmed) return false; // 未配置模板，维持空笔记行为

  const plugin = getTemplaterPlugin(app);
  if (!plugin?.templater) return false; // 未安装/未启用 Templater，静默降级
  const templater = plugin.templater;

  // 能力检测：Templater 升级导致内部 API 变化时静默降级
  if (typeof templater.create_running_config !== 'function'
    || typeof templater.read_and_parse_template !== 'function') {
    console.warn('[NoteCalendar] Templater 内部 API 不可用，已跳过模板套用');
    return false;
  }

  // 模板文件校验：路径错误时提示并保留空笔记
  const templateFile = app.vault.getAbstractFileByPath(templatePathTrimmed);
  if (!(templateFile instanceof TFile)) {
    new Notice(`模板文件不存在，已创建空笔记：${templatePathTrimmed}`);
    return false;
  }

  // 冲突检测：Templater 文件夹模板会命中时交给 Templater 处理，避免双重套用
  if (templaterFolderTemplateWillMatch(plugin, noteFile)) {
    console.log('[NoteCalendar] Templater 文件夹模板已命中，跳过插件侧模板套用');
    return false;
  }

  try {
    // 等待文件 mtime 稳定后再写入（防与 on-create 触发竞态）
    await waitForFileSettle(app, noteFile);

    // 构建运行配置：优先 create_running_config；缺失时手动构造兼容配置
    // 注意：必须以 templater.xxx() 方法调用形式执行，保留内部 this 上下文
    let config: TemplaterRunningConfig;
    if (typeof templater.create_running_config === 'function') {
      config = templater.create_running_config(
        templateFile,
        noteFile,
        RUN_MODE_CREATE_NEW_FROM_TEMPLATE
      );
    } else {
      config = {
        target_file: noteFile,
        run_mode: RUN_MODE_CREATE_NEW_FROM_TEMPLATE,
        frontmatter: {}
      };
    }
    // Templater 2.18.0+ 要求配置带 frontmatter 字段（对齐 QuickAdd 的兼容处理）
    if (config.frontmatter === undefined) {
      config.frontmatter = {};
    }

    // 渲染模板并写回目标笔记
    const rendered = await templater.read_and_parse_template(config);
    await app.vault.modify(noteFile, rendered);
    return true;
  } catch (error) {
    console.error('[NoteCalendar] Templater 模板渲染失败:', error);
    const message = error instanceof Error ? error.message : String(error);
    new Notice(`模板渲染失败，已保留空笔记：${message}`);
    return false; // 渲染失败回退为空笔记，不中断创建流程
  }
}
