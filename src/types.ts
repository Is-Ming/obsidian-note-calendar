/**
 * 共享类型定义
 */

/**
 * 日历视图类型标识
 */
export const VIEW_TYPE_CALENDAR = 'note-calendar-view';

/**
 * 插件设置类型
 */
export interface NoteCalendarSettings {
  startOfWeek: 0 | 1; // 0=周日, 1=周一
  weekendColor: string; // 周末文字颜色
  themeColor: string; // 主题颜色
  followAccentColor: boolean; // 是否跟随 Obsidian 强调色
  themeMode: 'auto' | 'dark' | 'light'; // 主题模式
  showLunarDate: boolean; // 是否显示农历日期
  showSolarFestivals: boolean; // 是否显示阳历节日
  showLunarFestivals: boolean; // 是否显示农历节日
  showHolidayMarker: boolean; // 是否显示调休
  showJieQi: boolean; // 是否显示节气
  noteFolderPath: string; // 笔记扫描目录
  dateFormat: string; // （已废弃，仅用于迁移到 dailyTitleFormat）
  fontFamily: string; // 字体
  fontSize: number; // 字号
  // 各类型笔记的标题格式和默认路径
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
  // 季度显示配置
  showQuarterly: boolean;
  quarterlyMode: 'number' | 'season' | 'custom';
  quarterStartMonth: number; // 1-12，首个季的起始月
  quarterlyCustomNames: string;
}

/**
 * 笔记类型
 */
export type NoteType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * 笔记缓存条目
 */
export interface NoteEntry {
  path: string;
  title: string;
  type: 'created' | 'updated';
  updatedAt: number; // 文件最后修改时间戳（毫秒），用于笔记列表按更新时间排序
}

/**
 * 日历网格数据
 */
export interface CalendarDayData {
  day: number;
  isCurrentMonth: boolean;
  date: Date;
  isToday?: boolean;
  weekNumber: number | null;
}
