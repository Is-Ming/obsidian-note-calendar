/**
 * lunar-javascript 类型声明（npm 包未自带 d.ts）
 * 仅声明当前插件用到的 API，未用到的保持未声明。
 */
declare module 'lunar-javascript' {
  export class Solar {
    static fromDate(date: Date): Solar;
    // 库内部会 y *= 1 隐式转数字，因此接受字符串（与原版 JS 调用方式一致）
    static fromYmd(year: number | string, month: number | string, day: number | string): Solar;
    getLunar(): Lunar;
    getFestivals(): string[];
  }

  export class Lunar {
    getDayInChinese(): string;
    getMonthInChinese(): string;
    getYearInGanZhi(): string;
    getYearShengXiao(): string;
    getFestivals(): string[];
    getJieQi(): string;
  }

  export class HolidayUtil {
    static getHoliday(year: number, month: number, day: number): Holiday | null;
  }

  export class Holiday {
    isWork(): boolean;
  }
}
