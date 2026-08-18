import type { CalendarDayData, NoteCalendarSettings, NoteEntry } from './types';

/**
 * 日历数据模型
 */
export class CalendarModel {
  currentDate: Date;
  viewYear: number;
  viewMonth: number;
  startOfWeek: number; // 0=周日, 1=周一
  weekendColor: string;
  themeColor: string;
  followAccentColor: boolean;
  showLunarDate: boolean;
  showSolarFestivals: boolean;
  showLunarFestivals: boolean;
  showHolidayMarker: boolean;
  showJieQi: boolean;
  noteFolderPath: string;
  fontFamily: string;
  fontSize: number;
  themeMode: 'auto' | 'dark' | 'light';
  dailyTitleFormat: string;
  dailyFolderPath: string;
  weeklyTitleFormat: string;
  weeklyFolderPath: string;
  quarterlyTitleFormat: string;
  quarterlyFolderPath: string;
  yearlyTitleFormat: string;
  yearlyFolderPath: string;
  monthlyTitleFormat: string;
  monthlyFolderPath: string;
  showQuarterly: boolean;
  quarterlyMode: 'number' | 'season' | 'custom';
  quarterStartMonth: number;
  quarterlyCustomNames: string;
  selectedDate: Date | null;
  noteCache: Record<string, NoteEntry[]>;

  constructor(settings: Partial<NoteCalendarSettings> = {}) {
    this.currentDate = new Date();
    this.viewYear = this.currentDate.getFullYear();
    this.viewMonth = this.currentDate.getMonth() + 1; // 1-12
    this.startOfWeek = settings.startOfWeek || 0; // 0=周日, 1=周一
    this.weekendColor = settings.weekendColor || '#e57373'; // 周六周日颜色
    this.themeColor = settings.themeColor || '#5d4ed8'; // 主题颜色
    this.followAccentColor = !!settings.followAccentColor; // 是否跟随 Obsidian 强调色
    this.showLunarDate = settings.showLunarDate !== undefined ? settings.showLunarDate : true;
    this.showSolarFestivals = settings.showSolarFestivals !== undefined ? settings.showSolarFestivals : true;
    this.showLunarFestivals = settings.showLunarFestivals !== undefined ? settings.showLunarFestivals : true;
    this.showHolidayMarker = settings.showHolidayMarker !== undefined ? settings.showHolidayMarker : true;
    this.showJieQi = settings.showJieQi !== undefined ? settings.showJieQi : true;
    this.noteFolderPath = settings.noteFolderPath || '';
    this.fontFamily = settings.fontFamily || 'default';
    this.fontSize = settings.fontSize || 14;
    this.themeMode = settings.themeMode || 'auto';
    // 各类型笔记的标题格式和默认路径（v0.3.4）
    this.dailyTitleFormat = settings.dailyTitleFormat || 'YYYY-MM-DD';
    this.dailyFolderPath = settings.dailyFolderPath || '';
    this.weeklyTitleFormat = settings.weeklyTitleFormat || 'YYYY-{week}周';
    this.weeklyFolderPath = settings.weeklyFolderPath || '';
    this.quarterlyTitleFormat = settings.quarterlyTitleFormat || 'YYYY年-{quarter}季度';
    this.quarterlyFolderPath = settings.quarterlyFolderPath || '';
    this.yearlyTitleFormat = settings.yearlyTitleFormat || 'YYYY';
    this.yearlyFolderPath = settings.yearlyFolderPath || '';
    this.monthlyTitleFormat = settings.monthlyTitleFormat || 'YYYY年MM月';
    this.monthlyFolderPath = settings.monthlyFolderPath || '';
    this.showQuarterly = settings.showQuarterly !== undefined ? settings.showQuarterly : true;
    this.quarterlyMode = settings.quarterlyMode || 'number';
    this.quarterStartMonth = settings.quarterStartMonth || 1;
    this.quarterlyCustomNames = settings.quarterlyCustomNames || '春季,夏季,秋季,冬季';
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
  setWeekendColor(color: string): void {
    this.weekendColor = color;
  }

  /**
   * 更新主题颜色
   */
  setThemeColor(color: string): void {
    this.themeColor = color;
  }

  /**
   * 格式化日期为YYYY-MM-DD
   */
  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 获取指定日期的笔记列表
   */
  getNotesForDate(dateStr: string): NoteEntry[] {
    return this.noteCache[dateStr] || [];
  }

  /**
   * 检查指定日期是否有笔记
   */
  hasNotesForDate(dateStr: string): boolean {
    return this.noteCache[dateStr] && this.noteCache[dateStr].length > 0;
  }

  /**
   * 获取当前视图的年月
   */
  getViewDate(): { year: number; month: number } {
    return { year: this.viewYear, month: this.viewMonth };
  }

  /**
   * 设置视图日期
   */
  setViewDate(year: number, month: number): void {
    this.viewYear = year;
    this.viewMonth = month;
  }

  /**
   * 上一个月
   */
  previousMonth(): void {
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
  nextMonth(): void {
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
  previousYear(): void {
    this.viewYear--;
  }

  /**
   * 下一年
   */
  nextYear(): void {
    this.viewYear++;
  }

  /**
   * 获取月份的第一天是星期几 (0=周日, 1=周一, ..., 6=周六)
   */
  getFirstDayOfMonth(year: number, month: number): number {
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
   */
  getWeekdayLabels(): string[] {
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
  getDaysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }

  /**
   * 获取日历网格数据
   */
  getCalendarData(): CalendarDayData[] {
    const firstDay = this.getFirstDayOfMonth(this.viewYear, this.viewMonth);
    const daysInMonth = this.getDaysInMonth(this.viewYear, this.viewMonth);

    const calendarDays: CalendarDayData[] = [];

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
  isToday(year: number, month: number, day: number): boolean {
    const today = new Date();
    return today.getFullYear() === year &&
           today.getMonth() + 1 === month &&
           today.getDate() === day;
  }

  /**
   * 计算周数
   */
  getWeekNumber(date: Date): number {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  }

  /**
   * 跳转到今天
   */
  goToToday(): void {
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
  selectDate(year: number, month: number, day: number): void {
    this.selectedDate = new Date(year, month - 1, day);
  }

  /**
   * 判断是否是选中的日期
   */
  isSelectedDate(year: number, month: number, day: number): boolean {
    if (!this.selectedDate) return false;
    return this.selectedDate.getFullYear() === year &&
           this.selectedDate.getMonth() + 1 === month &&
           this.selectedDate.getDate() === day;
  }
}
