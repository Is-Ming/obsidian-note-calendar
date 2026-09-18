import { Plugin, TFile } from 'obsidian';
import { formatDate } from './model';
import { CalendarSettingTab, DEFAULT_SETTINGS } from './settings';
import { VIEW_TYPE_CALENDAR } from './types';
import type { NoteCalendarSettings, NoteEntry } from './types';
import { CalendarView } from './view';

/**
 * 插件主体
 */
class NoteCalendarPlugin extends Plugin {
  settings!: NoteCalendarSettings;

  /**
   * 笔记缓存（Plugin 级单一数据源）
   *
   * 缓存放在 Plugin 上而不是视图模型上，原因：
   * Obsidian 会销毁并重建长期不可见的侧栏视图，视图重建时会 new 出
   * 全新的 CalendarModel（noteCache 为空），导致笔记列表丢失。
   * 缓存由 Plugin 持有后，视图只持有同一份对象引用，重建不影响数据。
   *
   * 结构：{ "YYYY-MM-DD": NoteEntry[] }
   */
  noteCache: Record<string, NoteEntry[]> = {};

  /**
   * 全量扫描进行中标记，用于防止并发重复全量扫描（全量扫描成本较高）
   */
  isScanning = false;

  /**
   * 扫描期间收到的新触发请求：当前扫描结束后补跑一次，避免触发被吞掉
   */
  private scanPending = false;

  async onload(): Promise<void> {

    // 加载设置
    await this.loadSettings();

    // 注册日历视图类型
    this.registerView(
      VIEW_TYPE_CALENDAR,
      (leaf) => new CalendarView(leaf, this)
    );

    // 添加设置菜单
    this.addSettingTab(new CalendarSettingTab(this.app, this));

    // 添加命令：切换日历视图
    this.addCommand({
      id: 'toggle-note-calendar',
      name: '切换日历视图',
      checkCallback: (checking) => {
        // 总是允许调用，由我们自己管理切换逻辑
        return true;
      },
      callback: () => {
        this.toggleCalendarView();
      }
    });

    // 添加命令：重新扫描笔记
    // 供手动兜底使用，等价于设置面板「笔记扫描 → 扫描」按钮。
    // 正常情况下缓存由文件事件自动维护，此命令仅用于异常排查。
    this.addCommand({
      id: 'rescan-notes',
      name: '重新扫描笔记',
      callback: () => {
        this.scanNotes();
      }
    });

    // 在布局准备好时自动初始化视图
    this.app.workspace.onLayoutReady(() => {
      this.initLeaf();
      // 初始扫描笔记。缓存由 Plugin 持有、不依赖视图，故无需等待视图创建
      this.scanNotes();
    });

    // 监听文件创建事件
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if ((file as TFile).extension === 'md') {
          console.log(`[NoteCalendar] 文件创建: ${file.path}`);
          // 检查文件路径是否在指定文件夹下
          if (this.settings.noteFolderPath && !file.path.startsWith(this.settings.noteFolderPath)) {
            return;
          }
          // 延迟扫描，确保文件已经保存
          setTimeout(() => {
            this.updateTodayNote(file.path);
          }, 500);
        }
      })
    );
    // 监听文件修改事件
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if ((file as TFile).extension === 'md') {
          console.log(`[NoteCalendar] 文件修改: ${file.path}`);
          // 检查文件路径是否在指定文件夹下
          if (this.settings.noteFolderPath && !file.path.startsWith(this.settings.noteFolderPath)) {
            return;
          }
          // 延迟扫描，确保文件已经保存
          setTimeout(() => {
            this.updateTodayNote(file.path);
          }, 500);
        }
      })
    );

    // 监听文件重命名事件
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        if ((file as TFile).extension === 'md') {
          console.log(`[NoteCalendar] 文件重命名: ${oldPath} -> ${file.path}`);
          // 检查文件路径是否在指定文件夹下
          if (this.settings.noteFolderPath && !file.path.startsWith(this.settings.noteFolderPath)) {
            return;
          }
          // 延迟处理，确保文件已经保存
          setTimeout(() => {
            this.handleFileRename(oldPath, file.path);
          }, 500);
        }
      })
    );

    // 监听文件删除事件
    this.registerEvent(
      this.app.vault.on('delete', async (file) => {
        if ((file as TFile).extension === 'md') {
          console.log(`[NoteCalendar] 文件删除: ${file.path}`);
          // 检查文件路径是否在指定文件夹下
          if (this.settings.noteFolderPath && !file.path.startsWith(this.settings.noteFolderPath)) {
            return;
          }

          // 找到该文件相关的所有日期
          const datesToClear: string[] = [];
          for (const dateStr in this.noteCache) {
            const notes = this.noteCache[dateStr];
            if (notes.some(note => note.path === file.path)) {
              datesToClear.push(dateStr);
            }
          }

          // 清空这些日期的缓存并重新扫描
          for (const dateStr of datesToClear) {
            console.log(`[NoteCalendar] 清空日期 ${dateStr} 的缓存`);
            delete this.noteCache[dateStr];
            await this.rescanDate(dateStr);
          }

          // 刷新所有日历视图
          this.renderAllViews();
        }
      })
    );

  }

  /**
   * 加载设置
   */
  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    // 迁移旧版 dateFormat 到 dailyTitleFormat
    if (data && data.dateFormat && !data.dailyTitleFormat) {
      data.dailyTitleFormat = data.dateFormat;
    }
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  /**
   * 保存设置
   */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * 更新设置
   */
  async updateSettings(newSettings: Partial<NoteCalendarSettings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };
    await this.saveSettings();

    // 更新所有打开的日历视图
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
    leaves.forEach(leaf => {
      const view = leaf.view as CalendarView;
      if (view.model) {
        view.model.startOfWeek = this.settings.startOfWeek;
        view.model.weekendColor = this.settings.weekendColor;
        view.model.themeColor = this.settings.themeColor;
        view.model.followAccentColor = this.settings.followAccentColor;
        view.model.showLunarDate = this.settings.showLunarDate;
        view.model.showSolarFestivals = this.settings.showSolarFestivals;
        view.model.showLunarFestivals = this.settings.showLunarFestivals;
        view.model.showJieQi = this.settings.showJieQi;
        view.model.showHolidayMarker = this.settings.showHolidayMarker;
        view.model.noteFolderPath = this.settings.noteFolderPath;
        view.model.fontFamily = this.settings.fontFamily;
        view.model.fontSize = this.settings.fontSize;
        view.model.themeMode = this.settings.themeMode;
        view.model.dailyTitleFormat = this.settings.dailyTitleFormat;
        view.model.dailyFolderPath = this.settings.dailyFolderPath;
        view.model.weeklyTitleFormat = this.settings.weeklyTitleFormat;
        view.model.weeklyFolderPath = this.settings.weeklyFolderPath;
        view.model.quarterlyTitleFormat = this.settings.quarterlyTitleFormat;
        view.model.quarterlyFolderPath = this.settings.quarterlyFolderPath;
        view.model.yearlyTitleFormat = this.settings.yearlyTitleFormat;
        view.model.yearlyFolderPath = this.settings.yearlyFolderPath;
        view.model.monthlyTitleFormat = this.settings.monthlyTitleFormat;
        view.model.monthlyFolderPath = this.settings.monthlyFolderPath;
        view.model.showQuarterly = this.settings.showQuarterly;
        view.model.quarterlyMode = this.settings.quarterlyMode;
        view.model.quarterStartMonth = this.settings.quarterStartMonth;
        view.model.quarterlyCustomNames = this.settings.quarterlyCustomNames;
        view.render();
      }
    });
  }

  /**
   * 全量扫描笔记并重建缓存
   *
   * 缓存写在 Plugin 上，不依赖日历视图是否存在：即使日历当前未打开，
   * 扫描结果也会被保留，等视图创建时直接复用。
   * 扫描完成后统一刷新所有已打开的日历视图。
   *
   * 并发保护：扫描进行中再次触发时只记录待补扫，当前扫描结束后自动补跑一次，
   * 避免重复的全量 IO（每个文件一次 stat，成本较高）。
   */
  async scanNotes(): Promise<void> {
    if (this.isScanning) {
      this.scanPending = true;
      console.log('[NoteCalendar] 扫描进行中，本次触发已排队');
      return;
    }
    this.isScanning = true;

    try {
      console.log('[NoteCalendar] 开始扫描笔记...');
      const noteCache: Record<string, NoteEntry[]> = {};

      // 获取所有markdown文件
      const files = this.app.vault.getMarkdownFiles();
      console.log(`[NoteCalendar] 找到 ${files.length} 个markdown文件`);
      console.log(`[NoteCalendar] 笔记文件夹路径: "${this.settings.noteFolderPath}"`);

      let processedCount = 0;
      for (const file of files) {
        // 检查文件路径是否在指定文件夹下
        if (this.settings.noteFolderPath && !file.path.startsWith(this.settings.noteFolderPath)) {
          continue;
        }

        // 获取文件的创建时间和修改时间
        const stat = await this.app.vault.adapter.stat(file.path);
        if (!stat) continue;

        // 格式化日期
        const createdDateStr = formatDate(new Date(stat.ctime));
        const modifiedDateStr = formatDate(new Date(stat.mtime));

        // 获取笔记标题（使用文件名，去掉.md后缀）
        const title = file.basename;

        // 创建日期始终记录
        if (!noteCache[createdDateStr]) {
          noteCache[createdDateStr] = [];
        }
        noteCache[createdDateStr].push({
          path: file.path,
          title: title,
          type: 'created', // created 或 updated
          updatedAt: stat.mtime // 记录更新时间，用于列表排序
        });

        // 创建日期与修改日期不在同一天时，额外记录修改日期
        if (createdDateStr !== modifiedDateStr) {
          if (!noteCache[modifiedDateStr]) {
            noteCache[modifiedDateStr] = [];
          }
          noteCache[modifiedDateStr].push({
            path: file.path,
            title: title,
            type: 'updated',
            updatedAt: stat.mtime // 记录更新时间，用于列表排序
          });
        }
        processedCount++;
      }

      console.log(`[NoteCalendar] 处理了 ${processedCount} 个笔记`);
      console.log(`[NoteCalendar] 笔记缓存日期数量: ${Object.keys(noteCache).length}`);

      // 原地重建缓存，保持对象引用不变（视图持有的正是同一个引用）
      this.replaceNoteCache(noteCache);

      // 刷新所有日历视图
      this.renderAllViews();
      console.log('[NoteCalendar] 笔记扫描完成');
    } finally {
      this.isScanning = false;
      // 扫描期间若有新的触发被排队，这里补跑一次
      if (this.scanPending) {
        this.scanPending = false;
        await this.scanNotes();
      }
    }
  }

  /**
   * 原地替换缓存内容（保持对象引用不变）
   *
   * 视图持有的 noteCache 是同一个对象引用，因此必须原地增删改，
   * 不能整体重新赋值，否则视图会与 Plugin 的缓存脱钩。
   * @param {Record<string, NoteEntry[]>} next - 新构建的缓存内容
   */
  private replaceNoteCache(next: Record<string, NoteEntry[]>): void {
    for (const key of Object.keys(this.noteCache)) {
      delete this.noteCache[key];
    }
    Object.assign(this.noteCache, next);
  }

  /**
   * 刷新所有已打开的日历视图（支持同时存在多个日历视图的场景）
   */
  renderAllViews(): void {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).forEach(leaf => {
      const view = leaf.view as CalendarView;
      if (view && typeof view.render === 'function') {
        view.render();
      }
    });
  }

  /**
   * 更新单个文件的笔记缓存（用于文件创建/修改事件）
   *
   * 只重扫该文件的创建日期与修改日期，成本远低于全量扫描。
   * 不依赖日历视图是否存在：日历未打开时事件依然会更新缓存。
   * @param {string} filePath - 发生变更的文件路径
   */
  async updateTodayNote(filePath: string): Promise<void> {
    // 获取文件信息
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file) return;

    // 获取文件stat
    const stat = await this.app.vault.adapter.stat(filePath);
    if (!stat) return;

    // 获取创建日期和修改日期
    const fileCreatedDateStr = formatDate(new Date(stat.ctime));
    const fileModifiedDateStr = formatDate(new Date(stat.mtime));

    console.log(`[NoteCalendar] 更新笔记缓存，文件: ${filePath}`);
    console.log(`[NoteCalendar] 创建日期: ${fileCreatedDateStr}, 修改日期: ${fileModifiedDateStr}`);

    // 收集需要更新的日期（去重）
    const datesToUpdate = new Set<string>();
    datesToUpdate.add(fileCreatedDateStr);
    if (fileModifiedDateStr !== fileCreatedDateStr) {
      datesToUpdate.add(fileModifiedDateStr);
    }

    // 更新每个日期的缓存
    for (const dateStr of datesToUpdate) {
      // 清空该日期的缓存
      if (this.noteCache[dateStr]) {
        console.log(`[NoteCalendar] 清空日期 ${dateStr} 的缓存`);
        delete this.noteCache[dateStr];
      }

      // 重新扫描该日期的笔记
      await this.rescanDate(dateStr);
    }

    // 刷新所有日历视图
    this.renderAllViews();
  }

  /**
   * 重新扫描指定日期的笔记（单日期粒度，用于文件事件的增量更新）
   * @param {string} dateStr - 目标日期，格式 YYYY-MM-DD
   */
  async rescanDate(dateStr: string): Promise<void> {
    console.log(`[NoteCalendar] 重新扫描日期: ${dateStr}`);

    // 获取所有 Markdown 文件
    const files = this.app.vault.getMarkdownFiles();
    const notesForDate: NoteEntry[] = [];

    for (const file of files) {
      // 检查文件夹过滤
      if (this.settings.noteFolderPath && !file.path.startsWith(this.settings.noteFolderPath)) {
        continue;
      }

      try {
        const stat = await this.app.vault.adapter.stat(file.path);
        if (!stat) continue;

        // 检查创建日期是否匹配
        const createdDateStr = formatDate(new Date(stat.ctime));
        if (createdDateStr === dateStr) {
          notesForDate.push({
            path: file.path,
            title: file.basename,
            type: 'created',
            updatedAt: stat.mtime // 记录更新时间，用于列表排序
          });
        }

        // 检查修改日期是否匹配（且不等于创建日期）
        const modifiedDateStr = formatDate(new Date(stat.mtime));
        if (modifiedDateStr === dateStr && createdDateStr !== dateStr) {
          notesForDate.push({
            path: file.path,
            title: file.basename,
            type: 'updated',
            updatedAt: stat.mtime // 记录更新时间，用于列表排序
          });
        }
      } catch (error) {
        console.error(`[NoteCalendar] 处理文件 ${file.path} 时出错:`, error);
      }
    }

    // 如果找到笔记，添加到缓存
    if (notesForDate.length > 0) {
      this.noteCache[dateStr] = notesForDate;
      console.log(`[NoteCalendar] 日期 ${dateStr} 找到 ${notesForDate.length} 个笔记`);
    } else if (this.noteCache[dateStr]) {
      // 没有找到笔记，删除缓存条目
      delete this.noteCache[dateStr];
      console.log(`[NoteCalendar] 日期 ${dateStr} 没有找到笔记，已删除缓存`);
    } else {
      console.log(`[NoteCalendar] 日期 ${dateStr} 没有找到笔记`);
    }
  }

  /**
   * 处理文件重命名
   *
   * 策略：清空旧路径涉及的日期 + 新文件创建/修改日期，再逐个重扫。
   * 不依赖日历视图是否存在。
   * @param {string} oldPath - 重命名前的路径
   * @param {string} newPath - 重命名后的路径
   */
  async handleFileRename(oldPath: string, newPath: string): Promise<void> {
    console.log(`[NoteCalendar] 处理文件重命名: ${oldPath} -> ${newPath}`);

    // 获取新文件信息
    const newFile = this.app.vault.getAbstractFileByPath(newPath);
    if (!newFile) return;

    // 获取文件stat
    const stat = await this.app.vault.adapter.stat(newPath);
    if (!stat) return;

    // 确定需要重新扫描的日期
    const createdDateStr = formatDate(new Date(stat.ctime));
    const modifiedDateStr = formatDate(new Date(stat.mtime));

    console.log(`[NoteCalendar] 文件创建日期: ${createdDateStr}, 修改日期: ${modifiedDateStr}`);

    // 收集需要重新扫描的日期
    const datesToRescan = new Set<string>();

    // 检查旧路径是否在缓存中
    for (const dateStr in this.noteCache) {
      const notes = this.noteCache[dateStr];
      if (notes.some(note => note.path === oldPath)) {
        datesToRescan.add(dateStr);
        console.log(`[NoteCalendar] 添加到重新扫描列表: ${dateStr}`);
      }
    }

    // 新文件的日期也要重新扫描
    datesToRescan.add(createdDateStr);
    if (modifiedDateStr !== createdDateStr) {
      datesToRescan.add(modifiedDateStr);
    }

    // 清空这些日期的缓存
    datesToRescan.forEach(dateStr => {
      if (this.noteCache[dateStr]) {
        delete this.noteCache[dateStr];
        console.log(`[NoteCalendar] 清空日期 ${dateStr} 的缓存`);
      }
    });

    // 重新扫描这些日期
    for (const dateStr of datesToRescan) {
      await this.rescanDate(dateStr);
    }

    // 刷新所有日历视图
    this.renderAllViews();
    console.log(`[NoteCalendar] 文件重命名处理完成`);
  }

  async onunload(): Promise<void> {
    // 卸载时关闭视图
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
    leaves.forEach(leaf => leaf.detach());
  }

  /**
   * 初始化日历视图（在布局准备好时调用）
   */
  initLeaf(): void {
    if (this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).length > 0) {
      return;
    }
    this.app.workspace.getRightLeaf(false)?.setViewState({
      type: VIEW_TYPE_CALENDAR
    });
  }

  /**
   * 切换日历视图显示/隐藏
   */
  async toggleCalendarView(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);

    if (leaves.length > 0) {
      // 如果已打开，关闭视图
      leaves[0].detach();
    } else {
      // 如果未打开，在右侧栏创建新视图
      const leaf = this.app.workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: VIEW_TYPE_CALENDAR,
          active: true
        });
      }
    }
  }
}

export = NoteCalendarPlugin;
