import { Plugin, TFile } from 'obsidian';
import { CalendarModel } from './model';
import { CalendarSettingTab, DEFAULT_SETTINGS } from './settings';
import { VIEW_TYPE_CALENDAR } from './types';
import type { NoteCalendarSettings, NoteEntry } from './types';
import { CalendarView } from './view';

/**
 * 插件主体
 */
class NoteCalendarPlugin extends Plugin {
  settings!: NoteCalendarSettings;

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

    // 在布局准备好时自动初始化视图
    this.app.workspace.onLayoutReady(() => {
      this.initLeaf();
      // 初始扫描笔记
      setTimeout(() => {
        this.scanNotes();
      }, 1000);
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

          // 清空该文件相关日期的缓存
          const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
          if (leaves.length > 0) {
            const view = leaves[0].view as CalendarView;
            if (view && view.model) {
              const model = view.model;

              // 找到该文件相关的所有日期
              const datesToClear: string[] = [];
              for (const dateStr in model.noteCache) {
                const notes = model.noteCache[dateStr];
                if (notes.some(note => note.path === file.path)) {
                  datesToClear.push(dateStr);
                }
              }

              // 清空这些日期的缓存并重新扫描
              for (const dateStr of datesToClear) {
                console.log(`[NoteCalendar] 清空日期 ${dateStr} 的缓存`);
                delete model.noteCache[dateStr];
                await this.rescanDate(model, dateStr);
              }

              // 重新渲染
              view.render();
            }
          }
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
   * 扫描笔记并更新缓存
   */
  async scanNotes(): Promise<void> {
    console.log('[NoteCalendar] 开始扫描笔记...');
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
    if (leaves.length === 0) {
      console.log('[NoteCalendar] 没有找到日历视图');
      return;
    }

    const view = leaves[0].view as CalendarView;
    if (!view || !view.model) {
      console.log('[NoteCalendar] 没有找到日历模型');
      return;
    }

    const model = view.model;
    const noteCache: Record<string, NoteEntry[]> = {};

    // 获取所有markdown文件
    const files = this.app.vault.getMarkdownFiles();
    console.log(`[NoteCalendar] 找到 ${files.length} 个markdown文件`);
    console.log(`[NoteCalendar] 笔记文件夹路径: "${this.settings.noteFolderPath}"`);

    let processedCount = 0;
    for (const file of files) {
      console.log(`[NoteCalendar] 正在处理文件: ${file}`);
      // 检查文件路径是否在指定文件夹下
      if (this.settings.noteFolderPath && !file.path.startsWith(this.settings.noteFolderPath)) {
        continue;
      }

      // 获取文件的创建时间和修改时间
      const stat = await this.app.vault.adapter.stat(file.path);
      if (!stat) continue;

      const createdDate = new Date(stat.ctime);
      const modifiedDate = new Date(stat.mtime);

      // 格式化日期
      const createdDateStr = model.formatDate(createdDate);
      const modifiedDateStr = model.formatDate(modifiedDate);

      // 获取笔记标题（使用文件名，去掉.md后缀）
      const title = file.basename;

      // 如果创建日期和修改日期在同一天，只记录创建日期
      if (createdDateStr === modifiedDateStr) {
        if (!noteCache[createdDateStr]) {
          noteCache[createdDateStr] = [];
        }
        noteCache[createdDateStr].push({
          path: file.path,
          title: title,
          type: 'created', // created 或 updated
          updatedAt: stat.mtime // 记录更新时间，用于列表排序
        });
      } else {
        // 记录创建日期
        if (!noteCache[createdDateStr]) {
          noteCache[createdDateStr] = [];
        }
        noteCache[createdDateStr].push({
          path: file.path,
          title: title,
          type: 'created',
          updatedAt: stat.mtime // 记录更新时间，用于列表排序
        });

        // 记录修改日期
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

    // 打印缓存内容（前3个日期）
    const dates = Object.keys(noteCache).slice(0, 3);
    dates.forEach(date => {
      console.log(`[NoteCalendar] 日期 ${date}: ${noteCache[date].length} 个笔记`);
    });

    // 更新模型的笔记缓存
    model.noteCache = noteCache;

    // 重新渲染日历
    view.render();
    console.log('[NoteCalendar] 笔记扫描完成');
  }

  /**
   * 更新笔记缓存（用于文件事件监听）
   * 策略：清空相关日期的缓存，重新扫描这些日期的笔记
   */
  async updateTodayNote(filePath: string): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
    if (leaves.length === 0) return;

    const view = leaves[0].view as CalendarView;
    if (!view || !view.model) return;

    const model = view.model;

    // 获取文件信息
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file) return;

    // 获取文件stat
    const stat = await this.app.vault.adapter.stat(filePath);
    if (!stat) return;

    // 获取创建日期和修改日期
    const fileCreatedDate = new Date(stat.ctime);
    const fileCreatedDateStr = model.formatDate(fileCreatedDate);

    const fileModifiedDate = new Date(stat.mtime);
    const fileModifiedDateStr = model.formatDate(fileModifiedDate);

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
      if (model.noteCache[dateStr]) {
        console.log(`[NoteCalendar] 清空日期 ${dateStr} 的缓存`);
        delete model.noteCache[dateStr];
      }

      // 重新扫描该日期的笔记
      await this.rescanDate(model, dateStr);
    }

    // 重新渲染
    view.render();
  }

  /**
   * 重新扫描指定日期的笔记
   */
  async rescanDate(model: CalendarModel, dateStr: string): Promise<void> {
    console.log(`[NoteCalendar] 重新扫描日期: ${dateStr}`);

    // 解析日期
    const [year, month, day] = dateStr.split('-').map(n => parseInt(n));
    const targetDate = new Date(year, month - 1, day);
    const targetDateStart = new Date(year, month - 1, day, 0, 0, 0, 0);
    const targetDateEnd = new Date(year, month - 1, day, 23, 59, 59, 999);

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

        const createdDate = new Date(stat.ctime);
        const modifiedDate = new Date(stat.mtime);

        // 检查创建日期是否匹配
        const createdDateStr = model.formatDate(createdDate);
        if (createdDateStr === dateStr) {
          notesForDate.push({
            path: file.path,
            title: file.basename,
            type: 'created',
            updatedAt: stat.mtime // 记录更新时间，用于列表排序
          });
        }

        // 检查修改日期是否匹配（且不等于创建日期）
        const modifiedDateStr = model.formatDate(modifiedDate);
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
      model.noteCache[dateStr] = notesForDate;
      console.log(`[NoteCalendar] 日期 ${dateStr} 找到 ${notesForDate.length} 个笔记`);
    } else {
      // 没有找到笔记，删除缓存条目
      if (model.noteCache[dateStr]) {
        delete model.noteCache[dateStr];
        console.log(`[NoteCalendar] 日期 ${dateStr} 没有找到笔记，已删除缓存`);
      } else {
        console.log(`[NoteCalendar] 日期 ${dateStr} 没有找到笔记`);
      }
    }
  }

  /**
   * 处理文件重命名
   * 策略：清空相关日期的缓存，重新扫描这些日期的笔记
   */
  async handleFileRename(oldPath: string, newPath: string): Promise<void> {
    console.log(`[NoteCalendar] 处理文件重命名: ${oldPath} -> ${newPath}`);

    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
    if (leaves.length === 0) return;

    const view = leaves[0].view as CalendarView;
    if (!view || !view.model) return;

    const model = view.model;

    // 获取新文件信息
    const newFile = this.app.vault.getAbstractFileByPath(newPath);
    if (!newFile) return;

    // 获取文件stat
    const stat = await this.app.vault.adapter.stat(newPath);
    if (!stat) return;

    // 确定需要重新扫描的日期
    const createdDate = new Date(stat.ctime);
    const modifiedDate = new Date(stat.mtime);
    const createdDateStr = model.formatDate(createdDate);
    const modifiedDateStr = model.formatDate(modifiedDate);

    console.log(`[NoteCalendar] 文件创建日期: ${createdDateStr}, 修改日期: ${modifiedDateStr}`);

    // 收集需要重新扫描的日期
    const datesToRescan = new Set<string>();

    // 检查旧路径是否在缓存中
    for (const dateStr in model.noteCache) {
      const notes = model.noteCache[dateStr];
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
      if (model.noteCache[dateStr]) {
        delete model.noteCache[dateStr];
        console.log(`[NoteCalendar] 清空日期 ${dateStr} 的缓存`);
      }
    });

    // 重新扫描这些日期
    for (const dateStr of datesToRescan) {
      await this.rescanDate(model, dateStr);
    }

    // 重新渲染视图
    view.render();
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
