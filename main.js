const { Plugin, ItemView, Setting, PluginSettingTab, Modal, Notice } = require('obsidian');

// 全局变量，用于存储lunar.js的导出对象
let Lunar, Solar, HolidayUtil;

const VIEW_TYPE_CALENDAR = 'note-calendar-view';

// 默认设置
const DEFAULT_SETTINGS = {
  startOfWeek: 0, // 0=周日, 1=周一
  weekendColor: '#840606', // 周六周日的颜色，默认为 RGB(132, 6, 6)
  themeColor: '#5d4ed8', // 主题颜色，默认为紫色
  showLunarDate: true, // 是否显示农历日期
  showSolarFestivals: true, // 是否显示阳历节日
  showLunarFestivals: true, // 是否显示农历节日
  showHolidayMarker: true, // 是否显示调休
  showJieQi: true, // 是否显示节气
  noteFolderPath: '', // 笔记文件夹路径，默认为空（根目录）
  dateFormat: 'YYYY-MM-DD', // 日期格式，默认为YYYY-MM-DD
  fontFamily: 'default', // 字体：默认、微软雅黑、宋体、黑体、Arial、Helvetica、Verdana、Tahoma、Segoe UI
  fontSize: 14 // 字号：10-20px，默认14px
};

/**
 * 日历数据模型
 */
class CalendarModel {
  constructor(settings = {}) {
    this.currentDate = new Date();
    this.viewYear = this.currentDate.getFullYear();
    this.viewMonth = this.currentDate.getMonth() + 1; // 1-12
    this.startOfWeek = settings.startOfWeek || 0; // 0=周日, 1=周一
    this.weekendColor = settings.weekendColor || '#999999'; // 周六周日颜色
    this.themeColor = settings.themeColor || '#5d4ed8'; // 主题颜色
    this.showLunarDate = settings.showLunarDate !== undefined ? settings.showLunarDate : true; // 是否显示农历日期
    this.showSolarFestivals = settings.showSolarFestivals !== undefined ? settings.showSolarFestivals : true; // 是否显示阳历节日
    this.showLunarFestivals = settings.showLunarFestivals !== undefined ? settings.showLunarFestivals : true; // 是否显示农历节日
    this.showHolidayMarker = settings.showHolidayMarker !== undefined ? settings.showHolidayMarker : true; // 是否显示调休
    this.showJieQi = settings.showJieQi !== undefined ? settings.showJieQi : true; // 是否显示节气
    this.noteFolderPath = settings.noteFolderPath || ''; // 笔记文件夹路径
    this.dateFormat = settings.dateFormat || 'YYYY-MM-DD'; // 日期格式
    this.fontFamily = settings.fontFamily || 'default'; // 字体
    this.fontSize = settings.fontSize || 14; // 字号
    // 初始化时默认选中今天
    const today = new Date();
    this.selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    this.selectedDate.setHours(0, 0, 0, 0);
    // 笔记缓存：按日期存储笔记信息
    this.noteCache = {};
  }

  /**
   * 更新周末颜色
   */
  setWeekendColor(color) {
    this.weekendColor = color;
  }

  /**
   * 更新主题颜色
   */
  setThemeColor(color) {
    this.themeColor = color;
  }

  /**
   * 格式化日期为YYYY-MM-DD
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 获取指定日期的笔记列表
   */
  getNotesForDate(dateStr) {
    return this.noteCache[dateStr] || [];
  }

  /**
   * 检查指定日期是否有笔记
   */
  hasNotesForDate(dateStr) {
    return this.noteCache[dateStr] && this.noteCache[dateStr].length > 0;
  }

  /**
   * 获取当前视图的年月
   */
  getViewDate() {
    return { year: this.viewYear, month: this.viewMonth };
  }

  /**
   * 设置视图日期
   */
  setViewDate(year, month) {
    this.viewYear = year;
    this.viewMonth = month;
  }

  /**
   * 上一个月
   */
  previousMonth() {
    if (this.viewMonth === 1) {
      this.viewMonth = 12;
      this.viewYear--;
    } else {
      this.viewMonth--;
    }
  }

  /**
   * 下一个月
   */
  nextMonth() {
    if (this.viewMonth === 12) {
      this.viewMonth = 1;
      this.viewYear++;
    } else {
      this.viewMonth++;
    }
  }

  /**
   * 上一年
   */
  previousYear() {
    this.viewYear--;
  }

  /**
   * 下一年
   */
  nextYear() {
    this.viewYear++;
  }

  /**
   * 获取月份的第一天是星期几 (0=周日, 1=周一, ..., 6=周六)
   * @param {number} year 年份
   * @param {number} month 月份
   * @returns {number} 调整后的星期数
   */
  getFirstDayOfMonth(year, month) {
    const date = new Date(year, month - 1, 1);
    let day = date.getDay();

    // 如果起始日是周一（1），需要调整
    if (this.startOfWeek === 1) {
      // 周日(0) -> 6, 周一(1) -> 0, 周二(2) -> 1, ...
      day = (day + 6) % 7;
    }

    return day;
  }

  /**
   * 获取星期标题
   * @returns {string[]} 星期标题数组
   */
  getWeekdayLabels() {
    if (this.startOfWeek === 0) {
      // 周日起始
      return ['日', '一', '二', '三', '四', '五', '六'];
    } else {
      // 周一起始
      return ['一', '二', '三', '四', '五', '六', '日'];
    }
  }

  /**
   * 获取月份的总天数
   */
  getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  /**
   * 获取日历网格数据
   */
  getCalendarData() {
    const firstDay = this.getFirstDayOfMonth(this.viewYear, this.viewMonth);
    const daysInMonth = this.getDaysInMonth(this.viewYear, this.viewMonth);

    const calendarDays = [];

    // 填充上个月的日期
    const prevMonthDays = this.getDaysInMonth(
      this.viewMonth === 1 ? this.viewYear - 1 : this.viewYear,
      this.viewMonth === 1 ? 12 : this.viewMonth - 1
    );
    const prevMonthYear = this.viewMonth === 1 ? this.viewYear - 1 : this.viewYear;
    const prevMonth = this.viewMonth === 1 ? 12 : this.viewMonth - 1;
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const date = new Date(prevMonthYear, prevMonth - 1, day);
      calendarDays.push({
        day: day,
        isCurrentMonth: false,
        date: date,
        weekNumber: null
      });
    }

    // 填充当月日期
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(this.viewYear, this.viewMonth - 1, i);
      calendarDays.push({
        day: i,
        isCurrentMonth: true,
        date: date,
        isToday: this.isToday(this.viewYear, this.viewMonth, i),
        weekNumber: this.getWeekNumber(date)
      });
    }

    // 填充下个月的日期（补齐6行，42个格子）
    const totalCells = 42;
    const remainingCells = totalCells - calendarDays.length;
    const nextMonthYear = this.viewMonth === 12 ? this.viewYear + 1 : this.viewYear;
    const nextMonth = this.viewMonth === 12 ? 1 : this.viewMonth + 1;
    for (let i = 1; i <= remainingCells; i++) {
      const date = new Date(nextMonthYear, nextMonth - 1, i);
      calendarDays.push({
        day: i,
        isCurrentMonth: false,
        date: date,
        weekNumber: null
      });
    }

    return calendarDays;
  }

  /**
   * 判断是否为今天
   */
  isToday(year, month, day) {
    const today = new Date();
    return today.getFullYear() === year &&
           today.getMonth() + 1 === month &&
           today.getDate() === day;
  }

  /**
   * 计算周数
   * @param {Date} date - 日期对象
   * @returns {number} 周数（1-52）
   */
getWeekNumber(date) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7; 
  target.setDate(target.getDate() - dayNr + 3); 
  const firstThursday = target.valueOf();
  target.setMonth(0, 1); 
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7); 
  }
  return 1 + Math.ceil((firstThursday - target) / 604800000); 
}

  /**
   * 跳转到今天
   */
  goToToday() {
    const today = new Date();
    this.viewYear = today.getFullYear();
    this.viewMonth = today.getMonth() + 1;
    // 创建一个时间一致的新日期对象
    this.selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    this.selectedDate.setHours(0, 0, 0, 0);
  }

  /**
   * 选择日期
   */
  selectDate(year, month, day) {
    this.selectedDate = new Date(year, month - 1, day);
  }

  /**
   * 判断是否是选中的日期
   */
  isSelectedDate(year, month, day) {
    if (!this.selectedDate) return false;
    return this.selectedDate.getFullYear() === year &&
           this.selectedDate.getMonth() + 1 === month &&
           this.selectedDate.getDate() === day;
  }
}

// 插件主体
module.exports = class NoteCalendarPlugin extends Plugin {
  async onload() {
    // 加载lunar.js
    const lunarPath = this.app.vault.adapter.basePath + "/.obsidian/plugins/" + this.manifest.id + "/lunar.js";
    const lunarModule = require(lunarPath);
    Lunar = lunarModule.Lunar;
    Solar = lunarModule.Solar;
    HolidayUtil = lunarModule.HolidayUtil;

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
        if (file.extension === 'md') {
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
        if (file.extension === 'md') {
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
        if (file.extension === 'md') {
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
        if (file.extension === 'md') {
          console.log(`[NoteCalendar] 文件删除: ${file.path}`);
          // 检查文件路径是否在指定文件夹下
          if (this.settings.noteFolderPath && !file.path.startsWith(this.settings.noteFolderPath)) {
            return;
          }
          
          // 清空该文件相关日期的缓存
          const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
          if (leaves.length > 0) {
            const view = leaves[0].view;
            if (view && view.model) {
              const model = view.model;
              
              // 找到该文件相关的所有日期
              const datesToClear = [];
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
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * 保存设置
   */
  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * 更新设置
   */
  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    await this.saveSettings();

    // 更新所有打开的日历视图
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
    leaves.forEach(leaf => {
      const view = leaf.view;
      if (view.model) {
        view.model.startOfWeek = this.settings.startOfWeek;
        view.model.weekendColor = this.settings.weekendColor;
        view.model.themeColor = this.settings.themeColor;
        view.model.showLunarDate = this.settings.showLunarDate;
        view.model.showSolarFestivals = this.settings.showSolarFestivals;
        view.model.showLunarFestivals = this.settings.showLunarFestivals;
        view.model.showJieQi = this.settings.showJieQi;
        view.model.showHolidayMarker = this.settings.showHolidayMarker;
        view.model.noteFolderPath = this.settings.noteFolderPath;
        view.model.dateFormat = this.settings.dateFormat;
        view.model.fontFamily = this.settings.fontFamily;
        view.model.fontSize = this.settings.fontSize;
        view.render();
      }
    });
  }

  /**
   * 扫描笔记并更新缓存
   */
  async scanNotes() {
    console.log('[NoteCalendar] 开始扫描笔记...');
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
    if (leaves.length === 0) {
      console.log('[NoteCalendar] 没有找到日历视图');
      return;
    }

    const view = leaves[0].view;
    if (!view || !view.model) {
      console.log('[NoteCalendar] 没有找到日历模型');
      return;
    }

    const model = view.model;
    const noteCache = {};

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
          type: 'created' // created 或 updated
        });
      } else {
        // 记录创建日期
        if (!noteCache[createdDateStr]) {
          noteCache[createdDateStr] = [];
        }
        noteCache[createdDateStr].push({
          path: file.path,
          title: title,
          type: 'created'
        });

        // 记录修改日期
        if (!noteCache[modifiedDateStr]) {
          noteCache[modifiedDateStr] = [];
        }
        noteCache[modifiedDateStr].push({
          path: file.path,
          title: title,
          type: 'updated'
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
  async updateTodayNote(filePath) {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
    if (leaves.length === 0) return;

    const view = leaves[0].view;
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
    const datesToUpdate = new Set();
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
  async rescanDate(model, dateStr) {
    console.log(`[NoteCalendar] 重新扫描日期: ${dateStr}`);
    
    // 解析日期
    const [year, month, day] = dateStr.split('-').map(n => parseInt(n));
    const targetDate = new Date(year, month - 1, day);
    const targetDateStart = new Date(year, month - 1, day, 0, 0, 0, 0);
    const targetDateEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
    
    // 获取所有 Markdown 文件
    const files = this.app.vault.getMarkdownFiles();
    const notesForDate = [];
    
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
            type: 'created'
          });
        }
        
        // 检查修改日期是否匹配（且不等于创建日期）
        const modifiedDateStr = model.formatDate(modifiedDate);
        if (modifiedDateStr === dateStr && createdDateStr !== dateStr) {
          notesForDate.push({
            path: file.path,
            title: file.basename,
            type: 'updated'
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
  async handleFileRename(oldPath, newPath) {
    console.log(`[NoteCalendar] 处理文件重命名: ${oldPath} -> ${newPath}`);
    
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
    if (leaves.length === 0) return;

    const view = leaves[0].view;
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
    const datesToRescan = new Set();
    
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

  async onunload() {
    // 卸载时关闭视图
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
    leaves.forEach(leaf => leaf.detach());
  }

  /**
   * 初始化日历视图（在布局准备好时调用）
   */
  initLeaf() {
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
  async toggleCalendarView() {
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

/**
 * 日历视图类
 */
class CalendarView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.model = new CalendarModel(plugin.settings || {});
    this.container = null;
    this.header = null;
    this.grid = null;
    this.todayBtn = null; // 今天按钮引用
  }

  /**
   * 获取视图类型
   */
  getViewType() {
    return VIEW_TYPE_CALENDAR;
  }

  /**
   * 获取显示文本
   */
  getDisplayText() {
    return '日历';
  }

  /**
   * 获取图标
   */
  getIcon() {
    return 'calendar-with-checkmark';
  }

  async onOpen() {
    // 添加视图类名
    this.contentEl.addClass('note-calendar-view');

    // 创建日历容器
    this.createCalendarView();
  }

  /**
   * 创建日历视图
   */
  createCalendarView() {
    // 清空容器
    this.contentEl.empty();

    // 应用CSS变量
    this.contentEl.style.setProperty('--calendar-weekend-color', this.model.weekendColor);
    this.contentEl.style.setProperty('--calendar-font-family', this.getFontFamilyValue());
    this.contentEl.style.setProperty('--calendar-font-size', this.model.fontSize + 'px');

    // 创建头部
    this.header = this.createHeader();
    this.contentEl.appendChild(this.header);

    // 创建网格
    this.grid = this.createGrid();
    this.contentEl.appendChild(this.grid);

    // 创建笔记列表容器
    this.notesList = this.createNotesList();
    this.contentEl.appendChild(this.notesList);

    // 确保DOM更新后再渲染
    requestAnimationFrame(() => {
      this.render();
    });

    this.container = this.contentEl;
  }

  /**
   * 创建头部
   */
  createHeader() {
    const header = document.createElement('div');
    header.className = 'calendar-header';

    // 左侧切换按钮组
    const leftNavGroup = document.createElement('div');
    leftNavGroup.className = 'calendar-nav-group calendar-nav-left';

    // 上一年按钮
    const prevYearBtn = document.createElement('button');
    prevYearBtn.className = 'calendar-btn calendar-nav-btn';
    prevYearBtn.textContent = '<<';
    prevYearBtn.onclick = () => {
      this.model.previousYear();
      this.render();
    };
    leftNavGroup.appendChild(prevYearBtn);

    // 上个月按钮
    const prevMonthBtn = document.createElement('button');
    prevMonthBtn.className = 'calendar-btn calendar-nav-btn';
    prevMonthBtn.textContent = '<';
    prevMonthBtn.onclick = () => {
      this.model.previousMonth();
      this.render();
    };
    leftNavGroup.appendChild(prevMonthBtn);

    header.appendChild(leftNavGroup);

    // 中间标题组（包含标题）
    const titleGroup = document.createElement('div');
    titleGroup.className = 'calendar-title-group';

    // 标题
    const title = document.createElement('div');
    title.className = 'calendar-title';
    titleGroup.appendChild(title);

    const lunarTitle = document.createElement('div');
    lunarTitle.className = 'calendar-lunar-title';
    titleGroup.appendChild(lunarTitle);
    
    header.appendChild(titleGroup);

    // 今天按钮（右上角绝对定位）
    const todayBtn = document.createElement('button');
    todayBtn.className = 'calendar-btn calendar-today-btn';
    todayBtn.textContent = '今';
    todayBtn.onclick = () => {
      this.model.goToToday();
      this.todayBtn.classList.add('calendar-today-btn-selected');
      this.render();
    };
    header.appendChild(todayBtn);
    this.todayBtn = todayBtn;

    // 右侧切换按钮组
    const rightNavGroup = document.createElement('div');
    rightNavGroup.className = 'calendar-nav-group calendar-nav-right';

    // 下个月按钮
    const nextMonthBtn = document.createElement('button');
    nextMonthBtn.className = 'calendar-btn calendar-nav-btn';
    nextMonthBtn.textContent = '>';
    nextMonthBtn.onclick = () => {
      this.model.nextMonth();
      this.render();
    };
    rightNavGroup.appendChild(nextMonthBtn);

    // 下一年按钮
    const nextYearBtn = document.createElement('button');
    nextYearBtn.className = 'calendar-btn calendar-nav-btn';
    nextYearBtn.textContent = '>>';
    nextYearBtn.onclick = () => {
      this.model.nextYear();
      this.render();
    };
    rightNavGroup.appendChild(nextYearBtn);

    header.appendChild(rightNavGroup);

    this.titleEl = title;
    this.lunarTitleEl = lunarTitle;
    return header;
  }

  /**
   * 创建网格
   */
  createGrid() {
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';
    return grid;
  }



  /**
   * 更新网格
   */
  updateGrid() {
    // 清空现有内容
    this.grid.innerHTML = '';

    // 获取日历数据
    const calendarData = this.model.getCalendarData();

    // 添加周数标题
    const weekNumberHeader = document.createElement('div');
    weekNumberHeader.className = 'calendar-week-number-header';
    weekNumberHeader.textContent = '周';
    this.grid.appendChild(weekNumberHeader);

    // 添加星期标题
    const weekdays = this.model.getWeekdayLabels();
    weekdays.forEach((day, index) => {
      const weekdayEl = document.createElement('div');
      weekdayEl.className = 'calendar-weekday';
      const isWeekend = (this.model.startOfWeek === 0 && index === 0) ||
                        (this.model.startOfWeek === 0 && index === 6) ||
                        (this.model.startOfWeek === 1 && index === 5) ||
                        (this.model.startOfWeek === 1 && index === 6);
      if (isWeekend) {
        weekdayEl.classList.add('calendar-weekend');
      }
      weekdayEl.textContent = day;
      this.grid.appendChild(weekdayEl);
    });

    // 用于跟踪当前的周数
    let currentWeekNumber = null;
    let dayInRow = 0;

    // 渲染周数和日期
    calendarData.forEach((dayData) => {
      var solarDay = Solar.fromDate(dayData.date);
      var lunarDay = solarDay.getLunar();
      var holiday = HolidayUtil.getHoliday(dayData.date.getFullYear(), dayData.date.getMonth() + 1, dayData.date.getDate());
      if (dayData.date) {
        // 检查是否是每行的第一个日期
        if (dayInRow === 0) {
          // 为每行都计算周数，即使日期是上个月或下个月的
          const weekNumber = dayData.weekNumber !== null ? dayData.weekNumber : this.model.getWeekNumber(dayData.date);

          // 添加周数单元格
          const weekNumberCell = document.createElement('div');
          weekNumberCell.className = 'calendar-week-number';
          weekNumberCell.textContent = weekNumber;
          this.grid.appendChild(weekNumberCell);
          currentWeekNumber = weekNumber;
        }

        // 添加日期单元格
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';

        if (!dayData.isCurrentMonth) {
          dayCell.classList.add('calendar-day-other');
        }

        if (dayData.isToday) {
          dayCell.classList.add('calendar-day-today');
        }

        // 处理周末颜色逻辑 - 跟随调休状态
        const isWeekend = dayData.date && (dayData.date.getDay() === 0 || dayData.date.getDay() === 6);
        const hasHoliday = holiday !== null;

        if (isWeekend) {
          dayCell.classList.add('calendar-day-weekend');
          // 如果周末有"班"字（调休上班），显示为白色
          if (hasHoliday && holiday.isWork()) {
            dayCell.classList.add('calendar-day-weekend-work');
          }
        } else {
          // 如果周内有"休"字（放假），显示为红色（周末颜色）
          if (hasHoliday && !holiday.isWork()) {
            dayCell.classList.add('calendar-day-holiday-rest-color');
          }
        }

        // 检查是否是选中的日期
        if (this.model.isSelectedDate(dayData.date.getFullYear(), dayData.date.getMonth() + 1, dayData.date.getDate())) {
          dayCell.classList.add('calendar-day-selected');
        }

        // 创建公历日期元素
        const dayText = document.createElement('div');
        dayText.className = 'calendar-day-text';
        dayText.textContent = dayData.day;
        dayCell.appendChild(dayText);

        // 添加农历日期
        if (this.model.showLunarDate) {
          const lunarDayText = document.createElement('div');
          lunarDayText.className = 'calendar-day-lunar';
          const dayInChinese = lunarDay.getDayInChinese();
          // 如果是初一，显示月份
          if (dayInChinese === '初一') {
            lunarDayText.textContent = lunarDay.getMonthInChinese()+"月";
          } else {
            lunarDayText.textContent = dayInChinese;
          }
          dayCell.appendChild(lunarDayText);
        }


        // 获取农历节日
        if (this.model.showLunarFestivals) {
          const lunarFestivals = lunarDay.getFestivals();
          if (lunarFestivals && lunarFestivals.length > 0) {
            const lunarFestivalText = document.createElement('div');
            lunarFestivalText.className = 'calendar-day-festival';
            lunarFestivalText.textContent = lunarFestivals[0];
            dayCell.appendChild(lunarFestivalText);
          }
        }


        // 获取阳历节日
        if (this.model.showSolarFestivals) {
          const solarFestivals = solarDay.getFestivals();
          if (solarFestivals && solarFestivals.length > 0) {
            const solarFestivalText = document.createElement('div');
            solarFestivalText.className = 'calendar-day-festival';
            solarFestivalText.textContent = solarFestivals[0];
            dayCell.appendChild(solarFestivalText);
          }
        }

        // 获取节气
        if (this.model.showJieQi) {
          const lunarJieQi = lunarDay.getJieQi();
          if (lunarJieQi) {
            const lunarJieQiText = document.createElement('div');
            lunarJieQiText.className = 'calendar-day-festival';
            lunarJieQiText.textContent = lunarJieQi;
            dayCell.appendChild(lunarJieQiText);
          }
        }

        // 添加调休标示
        if (holiday && this.model.showHolidayMarker) {
          const holidayMarker = document.createElement('div');
          holidayMarker.className = 'calendar-holiday-marker';
          if (holiday.isWork()) {
            // isWork()为true表示调休上班，显示"班"
            holidayMarker.classList.add('calendar-holiday-work');
            holidayMarker.textContent = '班';
          } else {
            // isWork()为false表示放假，显示"休"
            holidayMarker.classList.add('calendar-holiday-rest');
            holidayMarker.textContent = '休';
          }
          dayCell.appendChild(holidayMarker);
        }

        // 添加笔记圆点标记
        const dateStr = this.model.formatDate(dayData.date);
        const notes = this.model.getNotesForDate(dateStr);
        if (notes.length > 0) {
          const noteDotsContainer = document.createElement('div');
          noteDotsContainer.className = 'calendar-note-dots';
          
          // 最多显示两个圆点，一个是创建，一个是更新
          const hasCreated = notes.some(n => n.type === 'created');
          const hasUpdated = notes.some(n => n.type === 'updated');
          if (hasCreated) {
            const dotCreated = document.createElement('div');
            dotCreated.className = 'calendar-note-dot';
            dotCreated.classList.add('calendar-note-dot-created');
            noteDotsContainer.appendChild(dotCreated);
          }

          if (hasUpdated) {
            const dotUpdate = document.createElement('div');
            dotUpdate.className = 'calendar-note-dot';
            dotUpdate.classList.add('calendar-note-dot-updated');
            noteDotsContainer.appendChild(dotUpdate);
          }
          dayCell.appendChild(noteDotsContainer);
        }

        // 添加点击事件
        dayCell.onclick = () => {
          const year = dayData.date.getFullYear();
          const month = dayData.date.getMonth() + 1;
          const day = dayData.date.getDate();
          this.model.selectDate(year, month, day);
          this.render();
        };        

        this.grid.appendChild(dayCell);

        // 更新行内日期计数
        dayInRow++;
        if (dayInRow === 7) {
          dayInRow = 0;
        }
      }
    });
  }

  /**
   * 创建笔记列表容器
   */
  createNotesList() {
    const container = document.createElement('div');
    container.className = 'calendar-notes-list';
    
    // 创建标题容器（包含创建按钮和日期标题）
    const titleContainer = document.createElement('div');
    titleContainer.className = 'calendar-notes-title-container';
    
    // 创建按钮组
    const createBtnGroup = document.createElement('div');
    createBtnGroup.className = 'calendar-create-btn-group';
    
    // 日记创建按钮
    const createBtn = document.createElement('button');
    createBtn.className = 'calendar-create-note-btn';
    createBtn.textContent = '+';
    createBtn.title = '创建日记';
    createBtn.onclick = () => this.showCreateNoteDialog('daily');
    createBtnGroup.appendChild(createBtn);
    
    // 周周记创建按钮
    const createWeeklyBtn = document.createElement('button');
    createWeeklyBtn.className = 'calendar-create-note-btn';
    createWeeklyBtn.textContent = '周';
    createWeeklyBtn.title = '创建周周记';
    createWeeklyBtn.onclick = () => this.showCreateNoteDialog('weekly');
    createBtnGroup.appendChild(createWeeklyBtn);
    
    // 季度笔记创建按钮
    const createQuarterlyBtn = document.createElement('button');
    createQuarterlyBtn.className = 'calendar-create-note-btn';
    createQuarterlyBtn.textContent = '季';
    createQuarterlyBtn.title = '创建季度笔记';
    createQuarterlyBtn.onclick = () => this.showCreateNoteDialog('quarterly');
    createBtnGroup.appendChild(createQuarterlyBtn);
    
    // 年度笔记创建按钮
    const createYearlyBtn = document.createElement('button');
    createYearlyBtn.className = 'calendar-create-note-btn';
    createYearlyBtn.textContent = '年';
    createYearlyBtn.title = '创建年度笔记';
    createYearlyBtn.onclick = () => this.showCreateNoteDialog('yearly');
    createBtnGroup.appendChild(createYearlyBtn);
    
    titleContainer.appendChild(createBtnGroup);
    
    // 创建日期标题
    const titleEl = document.createElement('div');
    titleEl.className = 'calendar-notes-title';
    titleContainer.appendChild(titleEl);
    
    container.appendChild(titleContainer);
    
    // 创建笔记列表容器
    const notesContainer = document.createElement('div');
    notesContainer.className = 'calendar-notes-items';
    container.appendChild(notesContainer);
    
    return container;
  }

  /**
   * 更新笔记列表
   */
  updateNotesList() {
    if (!this.notesList) return;

    // 清空笔记列表
    this.notesList.empty();

    // 获取选中日期
    const selectedDate = this.model.selectedDate;
    if (!selectedDate) return;

    // 格式化日期显示
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // 创建标题容器（包含创建按钮和日期标题）
    const titleContainer = document.createElement('div');
    titleContainer.className = 'calendar-notes-title-container';
    
    // 创建按钮组
    const createBtnGroup = document.createElement('div');
    createBtnGroup.className = 'calendar-create-btn-group';
    
    // 日记创建按钮
    const createBtn = document.createElement('button');
    createBtn.className = 'calendar-create-note-btn';
    createBtn.textContent = '+';
    createBtn.title = '创建日记';
    createBtn.onclick = () => this.showCreateNoteDialog('daily');
    createBtnGroup.appendChild(createBtn);
    
    // 周周记创建按钮
    const createWeeklyBtn = document.createElement('button');
    createWeeklyBtn.className = 'calendar-create-note-btn';
    createWeeklyBtn.textContent = '周';
    createWeeklyBtn.title = '创建周周记';
    createWeeklyBtn.onclick = () => this.showCreateNoteDialog('weekly');
    createBtnGroup.appendChild(createWeeklyBtn);
    
    // 季度笔记创建按钮
    const createQuarterlyBtn = document.createElement('button');
    createQuarterlyBtn.className = 'calendar-create-note-btn';
    createQuarterlyBtn.textContent = '季';
    createQuarterlyBtn.title = '创建季度笔记';
    createQuarterlyBtn.onclick = () => this.showCreateNoteDialog('quarterly');
    createBtnGroup.appendChild(createQuarterlyBtn);
    
    // 年度笔记创建按钮
    const createYearlyBtn = document.createElement('button');
    createYearlyBtn.className = 'calendar-create-note-btn';
    createYearlyBtn.textContent = '年';
    createYearlyBtn.title = '创建年度笔记';
    createYearlyBtn.onclick = () => this.showCreateNoteDialog('yearly');
    createBtnGroup.appendChild(createYearlyBtn);
    
    titleContainer.appendChild(createBtnGroup);
    
    // 创建日期标题
    const titleEl = document.createElement('div');
    titleEl.className = 'calendar-notes-title';
    titleEl.textContent = `${year}年${month}月${day}日`;
    titleContainer.appendChild(titleEl);
    
    this.notesList.appendChild(titleContainer);

    // 获取该日期的笔记列表
    const notes = this.model.getNotesForDate(dateStr);
    console.log(`[NoteCalendar] 更新笔记列表，日期: ${dateStr}, 笔记数量: ${notes.length}`);

    // 创建笔记列表容器
    const notesContainer = document.createElement('div');
    notesContainer.className = 'calendar-notes-items';

    if (notes.length > 0) {
      notes.forEach(note => {
        const noteItem = document.createElement('div');
        noteItem.className = 'calendar-note-item';

        // 创建圆点
        const dot = document.createElement('div');
        dot.className = 'calendar-note-item-dot';
        if (note.type === 'created') {
          dot.classList.add('calendar-note-dot-created');
        } else {
          dot.classList.add('calendar-note-dot-updated');
        }
        noteItem.appendChild(dot);

        // 创建标题
        const titleSpan = document.createElement('span');
        titleSpan.className = 'calendar-note-item-title';
        titleSpan.textContent = note.title;
        noteItem.appendChild(titleSpan);

        // 添加点击事件
        noteItem.onclick = async () => {
          console.log(`[NoteCalendar] 点击笔记: ${note.path}`);
          // 打开笔记文件
          const file = this.app.vault.getAbstractFileByPath(note.path);
          if (file) {
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
          }
        };

        notesContainer.appendChild(noteItem);
      });
    } else {
      // 显示无笔记提示
      const emptyEl = document.createElement('div');
      emptyEl.className = 'calendar-notes-empty';
      emptyEl.textContent = '该日期暂无笔记';
      notesContainer.appendChild(emptyEl);
    }

    this.notesList.appendChild(notesContainer);
  }

  /**
   * 计算周数
   * @param {Date} date - 日期对象
   * @returns {number} 周数（1-52/53）
   */
  getWeekNumber(date) {
    const target = new Date(date.valueOf());
    target.setDate(target.getDate() + 4 - (target.getDay() || 7));
    const yearStart = new Date(target.getFullYear(), 0, 1);
    return Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
  }

  /**
   * 显示创建笔记对话框
   */
  showCreateNoteDialog(type = 'daily') {
    const selectedDate = this.model.selectedDate;
    if (!selectedDate) return;
    
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    
    // 根据笔记类型生成默认标题
    let defaultTitle;
    switch (type) {
      case 'weekly':
        // 计算当前周数
        const weekNumber = this.getWeekNumber(selectedDate);
        defaultTitle = `${year}-${weekNumber}周`;
        break;
      case 'quarterly':
        // 计算当前季度
        const quarter = Math.floor(selectedDate.getMonth() / 3) + 1;
        defaultTitle = `${year}年-${quarter}季度`;
        break;
      case 'yearly':
        defaultTitle = `${year}`;
        break;
      case 'daily':
      default:
        // 根据设置的日期格式生成默认标题
        const dateFormat = this.model.dateFormat || 'YYYY-MM-DD';
        defaultTitle = dateFormat
          .replace('YYYY', year)
          .replace('MM', month)
          .replace('DD', day);
        break;
    }
    
    // 创建对话框
    const modal = new Modal(this.app);
    modal.titleEl.textContent = type === 'daily' ? '创建新笔记' : `创建${type === 'weekly' ? '周周记' : type === 'quarterly' ? '季度笔记' : '年度笔记'}`;
    
    // 创建表单
    const form = document.createElement('form');
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '16px';
    
    // 标题输入框
    const titleDiv = document.createElement('div');
    titleDiv.style.display = 'flex';
    titleDiv.style.flexDirection = 'column';
    
    const titleLabel = document.createElement('label');
    titleLabel.textContent = '笔记标题:';
    titleLabel.style.marginBottom = '4px';
    titleDiv.appendChild(titleLabel);
    
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = defaultTitle;
    titleInput.style.padding = '8px';
    titleInput.style.border = '1px solid var(--calendar-border)';
    titleInput.style.borderRadius = '4px';
    titleInput.style.backgroundColor = 'var(--calendar-bg)';
    titleInput.style.color = 'var(--calendar-text)';
    titleDiv.appendChild(titleInput);
    form.appendChild(titleDiv);
    
    // 文件夹路径输入框
    const folderDiv = document.createElement('div');
    folderDiv.style.display = 'flex';
    folderDiv.style.flexDirection = 'column';
    
    const folderLabel = document.createElement('label');
    folderLabel.textContent = '文件夹路径:';
    folderLabel.style.marginBottom = '4px';
    folderDiv.appendChild(folderLabel);
    
    const folderInput = document.createElement('input');
    folderInput.type = 'text';
    folderInput.placeholder = '例如: notes/日记';
    folderInput.style.padding = '8px';
    folderInput.style.border = '1px solid var(--calendar-border)';
    folderInput.style.borderRadius = '4px';
    folderInput.style.backgroundColor = 'var(--calendar-bg)';
    folderInput.style.color = 'var(--calendar-text)';
    folderDiv.appendChild(folderInput);
    form.appendChild(folderDiv);
    
    // 按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '8px';
    
    // 取消按钮
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = '取消';
    cancelBtn.style.padding = '8px 16px';
    cancelBtn.style.border = '1px solid var(--calendar-border)';
    cancelBtn.style.borderRadius = '4px';
    cancelBtn.style.backgroundColor = 'var(--calendar-bg)';
    cancelBtn.style.color = 'var(--calendar-text)';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.onclick = () => modal.close();
    buttonContainer.appendChild(cancelBtn);
    
    // 确认按钮
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.textContent = '确认';
    confirmBtn.style.padding = '8px 16px';
    confirmBtn.style.border = '1px solid var(--calendar-primary)';
    confirmBtn.style.borderRadius = '4px';
    confirmBtn.style.backgroundColor = 'var(--calendar-primary)';
    confirmBtn.style.color = '#ffffff';
    confirmBtn.style.cursor = 'pointer';
    confirmBtn.onclick = async () => {
      const title = titleInput.value.trim();
      const folderPath = folderInput.value.trim();
      
      if (!title) {
        new Notice('笔记标题不能为空');
        return;
      }
      
      await this.createNote(title, folderPath, type);
      modal.close();
    };
    buttonContainer.appendChild(confirmBtn);
    form.appendChild(buttonContainer);
    
    modal.contentEl.appendChild(form);
    modal.open();
  }

  /**
   * 创建笔记
   */
  async createNote(title, folderPath, type) {
    try {
      // 构建文件路径
      let filePath;
      if (folderPath) {
        // 确保文件夹路径以/结尾
        const normalizedFolderPath = folderPath.endsWith('/') ? folderPath : folderPath + '/';
        filePath = `${normalizedFolderPath}${title}.md`;
      } else {
        filePath = `${title}.md`;
      }
      
      // 检查文件是否已存在
      const existingFile = this.app.vault.getAbstractFileByPath(filePath);
      if (existingFile) {
        new Notice('该笔记已存在');
        return;
      }
      
      // 创建文件夹（如果不存在）
      if (folderPath) {
        const folderParts = folderPath.split('/');
        let currentPath = '';
        
        for (const part of folderParts) {
          if (!part) continue;
          currentPath += part + '/';
          
          const folder = this.app.vault.getAbstractFileByPath(currentPath);
          if (!folder) {
            await this.app.vault.createFolder(currentPath);
          }
        }
      }
      
      // 创建笔记文件
      await this.app.vault.create(filePath, '');
      
      // 显示成功通知
      new Notice('笔记创建成功');
      
      // 刷新笔记缓存
      this.plugin.scanNotes();
    } catch (error) {
      console.error('[NoteCalendar] 创建笔记失败:', error);
      new Notice('创建笔记失败');
    }
  }

  /**
   * 获取字体CSS值
   */
  getFontFamilyValue() {
    const fontMap = {
      'default': 'inherit',
      'microsoft-yahei': 'Microsoft YaHei',
      'simsun': 'SimSun',
      'simhei': 'SimHei',
      'arial': 'Arial',
      'helvetica': 'Helvetica',
      'verdana': 'Verdana',
      'tahoma': 'Tahoma',
      'segoe-ui': 'Segoe UI'
    };
    return fontMap[this.model.fontFamily] || 'inherit';
  }

  /**
   * 应用样式设置
   */
  applyStyles() {
    if (!this.contentEl) return;
    this.contentEl.style.setProperty('--calendar-weekend-color', this.model.weekendColor);
    this.contentEl.style.setProperty('--calendar-primary', this.model.themeColor);
    this.contentEl.style.setProperty('--calendar-font-family', this.getFontFamilyValue());
    this.contentEl.style.setProperty('--calendar-font-size', this.model.fontSize + 'px');
  }

  /**
   * 更新今天按钮的状态
   */
  updateTodayButtonState() {
    if (!this.todayBtn) return;

    const selectedDate = this.model.selectedDate;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let isTodaySelected = false;
    if (selectedDate) {
      const compareDate = new Date(selectedDate);
      compareDate.setHours(0, 0, 0, 0);
      isTodaySelected = compareDate.getFullYear() === today.getFullYear() &&
                     compareDate.getMonth() === today.getMonth() &&
                     compareDate.getDate() === today.getDate();
    }

    const hasSelectedClass = this.todayBtn.classList.contains('calendar-today-btn-selected');

    if (isTodaySelected && !hasSelectedClass) {
      this.todayBtn.classList.add('calendar-today-btn-selected');
    } else if (!isTodaySelected && hasSelectedClass) {
      this.todayBtn.classList.remove('calendar-today-btn-selected');
    }
  }

  /**
   * 渲染日历
   */
  render() {
    if (!this.container) return;

    // 应用样式设置
    this.applyStyles();

    // 更新今天按钮的状态
    this.updateTodayButtonState();

    // 更新头部标题
    this.updateHeader();

    // 更新网格
    this.updateGrid();

    // 更新笔记列表
    this.updateNotesList();
  }

  /**
   * 更新头部
   */
  updateHeader() {
    if (this.titleEl && this.lunarTitleEl) {
      const { year, month } = this.model.getViewDate();
      this.titleEl.textContent = `${year}年 ${month}月`;
      if (this.model.showLunarDate) {
        var lunarDay = Solar.fromYmd(year, month, 1).getLunar();
        var str = lunarDay.getYearInGanZhi() + lunarDay.getYearShengXiao() + "年 " + lunarDay.getMonthInChinese() + "月";
        this.lunarTitleEl.textContent = str;
      }else{
         this.lunarTitleEl.textContent = "";
      }
    }
  }

  /**
   * 创建日期单元格 
   */
  createDayCell(dayData) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    cell.textContent = dayData.day;

    if (!dayData.isCurrentMonth) {
      cell.classList.add('calendar-day-other');
    }

    if (dayData.isToday) {
      cell.classList.add('calendar-day-today');
    }

    // 如果是周六或周日，添加周末样式
    if (dayData.date) {
      const dayOfWeek = dayData.date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 0=周日, 6=周六
      if (isWeekend) {
        cell.classList.add('calendar-day-weekend');
      }

      // 检查是否是选中的日期
      if (this.model.isSelectedDate(dayData.date.getFullYear(), dayData.date.getMonth() + 1, dayData.date.getDate())) {
        cell.classList.add('calendar-day-selected');
      }

      // 添加点击事件
      cell.onclick = () => {
        const year = dayData.date.getFullYear();
        const month = dayData.date.getMonth() + 1;
        const day = dayData.date.getDate();
        this.model.selectDate(year, month, day);
        this.render();
      };
    }

    return cell;
  }

  async onClose() {
    // 视图关闭时的清理工作
  }
}

/**
 * 设置面板类
 */
class CalendarSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    // 添加说明文本
    containerEl.createEl('h2', { text: 'Note Calendar 设置' });

    // 一周起始日设置
    new Setting(containerEl)
      .setName('一周起始日')
      .setDesc('选择日历一周的第一天是周日还是周一')
      .addDropdown(dropdown => dropdown
        .addOption('0', '周日')
        .addOption('1', '周一')
        .setValue(String(this.plugin.settings.startOfWeek))
        .onChange(async (value) => {
          await this.plugin.updateSettings({
            startOfWeek: parseInt(value)
          });
        }));

    // 周末颜色设置
    new Setting(containerEl)
      .setName('周末颜色')
      .setDesc('周六和周日显示的颜色')
      .addColorPicker(colorPicker => colorPicker
        .setValue(this.plugin.settings.weekendColor)
        .onChange(async (value) => {
          await this.plugin.updateSettings({
            weekendColor: value
          });
        }));

    // 主题颜色设置
    new Setting(containerEl)
      .setName('主题颜色')
      .setDesc('今天、选中状态和节假日的显示颜色')
      .addColorPicker(colorPicker => colorPicker
        .setValue(this.plugin.settings.themeColor)
        .onChange(async (value) => {
          await this.plugin.updateSettings({
            themeColor: value
          });
        }));

    // 字体设置
    new Setting(containerEl)
      .setName('字体')
      .setDesc('选择日历使用的字体')
      .addDropdown(dropdown => dropdown
        .addOption('default', '默认')
        .addOption('microsoft-yahei', '微软雅黑')
        .addOption('simsun', '宋体')
        .addOption('simhei', '黑体')
        .addOption('arial', 'Arial')
        .addOption('helvetica', 'Helvetica')
        .addOption('verdana', 'Verdana')
        .addOption('tahoma', 'Tahoma')
        .addOption('segoe-ui', 'Segoe UI')
        .setValue(this.plugin.settings.fontFamily)
        .onChange(async (value) => {
          await this.plugin.updateSettings({
            fontFamily: value
          });
        }));

    // 字号设置
    new Setting(containerEl)
      .setName('字号')
      .setDesc('设置日历文字大小（10-20px）')
      .addSlider(slider => slider
        .setLimits(10, 20, 1)
        .setValue(this.plugin.settings.fontSize)
        .setDynamicTooltip()
        .onChange(async (value) => {
          await this.plugin.updateSettings({
            fontSize: Math.round(value)
          });
        }));
        
    new Setting(containerEl)
      .setName('是否显示公历假日')
      .setDesc('关闭后不再显示公历假日')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.showSolarFestivals)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              showSolarFestivals: value
            });
          });
      });
      new Setting(containerEl)
      .setName('是否显示调休')
      .setDesc('关闭后不再显示调休')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.showHolidayMarker)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              showHolidayMarker: value
            });
          });
      });
      new Setting(containerEl)
      .setName('是否显示农历日期')
      .setDesc('关闭后不再显示农历日期，月份，年份')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.showLunarDate)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              showLunarDate: value
            });
          });
      });
          new Setting(containerEl)
      .setName('是否显示农历假日')
      .setDesc('关闭后不再显示农历假日')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.showLunarFestivals)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              showLunarFestivals: value
            });
          });
      });
          new Setting(containerEl)
      .setName('是否显示农历节气')
      .setDesc('关闭后不再显示农历节气')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.showJieQi)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              showJieQi: value
            });
          });
      });

    // 笔记文件夹路径设置
    new Setting(containerEl)
      .setName('笔记文件夹路径')
      .setDesc('设置扫描笔记的文件夹路径（留空为根目录）')
      .addText(text => text
        .setPlaceholder('例如: Notes')
        .setValue(this.plugin.settings.noteFolderPath)
        .onChange(async (value) => {
          await this.plugin.updateSettings({
            noteFolderPath: value
          });
        }));

    // 日期格式设置
    new Setting(containerEl)
      .setName('日期格式')
      .setDesc('设置新建笔记的默认日期格式')
      .addDropdown(dropdown => dropdown
        .addOption('YYYY-MM-DD', 'YYYY-MM-DD')
        .addOption('YYYY/MM/DD', 'YYYY/MM/DD')
        .addOption('DD/MM/YYYY', 'DD/MM/YYYY')
        .addOption('MM/DD/YYYY', 'MM/DD/YYYY')
        .setValue(this.plugin.settings.dateFormat || 'YYYY-MM-DD')
        .onChange(async (value) => {
          await this.plugin.updateSettings({
            dateFormat: value
          });
        }));

    // 重新扫描笔记按钮
    new Setting(containerEl)
      .setName('重新扫描笔记')
      .setDesc('点击按钮重新扫描所有笔记')
      .addButton(button => button
        .setButtonText('扫描')
        .onClick(async () => {
          await this.plugin.scanNotes();
        }));

  }
}
