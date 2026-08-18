import { ItemView, Modal, Notice, TFile, TFolder, WorkspaceLeaf } from 'obsidian';
import { HolidayUtil, Solar } from 'lunar-javascript';
import type NoteCalendarPlugin from './main';
import { CalendarModel } from './model';
import { VIEW_TYPE_CALENDAR } from './types';
import type { CalendarDayData, NoteType } from './types';

/**
 * 日历视图类
 */
export class CalendarView extends ItemView {
  plugin: NoteCalendarPlugin;
  model: CalendarModel;
  container: HTMLElement | null;
  header: HTMLElement | null;
  grid: HTMLElement | null;
  todayBtn: HTMLElement | null; // 今天按钮引用
  notesList: HTMLElement | null;
  titleEl!: HTMLElement | null;
  lunarTitleEl!: HTMLElement | null;

  constructor(leaf: WorkspaceLeaf, plugin: NoteCalendarPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.model = new CalendarModel(plugin.settings || {});
    this.container = null;
    this.header = null;
    this.grid = null;
    this.todayBtn = null; // 今天按钮引用
    this.notesList = null;
    // 注意：不能在这里初始化 titleEl/lunarTitleEl。
    // Obsidian 的 ItemView 基类构造器会创建 this.titleEl（view-header-title），
    // 基类 load() 会调用 this.titleEl.setText(getDisplayText())；
    // 若此处置为 null 会导致视图打开时白页崩溃。
    // 这两个引用在 createHeader() 中才会被赋值。
  }

  /**
   * 获取视图类型
   */
  getViewType(): string {
    return VIEW_TYPE_CALENDAR;
  }

  /**
   * 获取显示文本
   */
  getDisplayText(): string {
    return '日历';
  }

  /**
   * 获取图标
   */
  getIcon(): string {
    return 'calendar-with-checkmark';
  }

  async onOpen(): Promise<void> {
    // 添加视图类名
    this.contentEl.addClass('note-calendar-view');

    // 创建日历容器
    this.createCalendarView();
  }

  /**
   * 创建日历视图
   */
  createCalendarView(): void {
    // 清空容器
    this.contentEl.empty();

    // 应用CSS变量
    this.contentEl.style.setProperty('--calendar-weekend-color', this.model.weekendColor);
    this.contentEl.style.setProperty('--calendar-font-family', this.getFontFamilyValue());
    this.contentEl.style.setProperty('--calendar-font-size', this.model.fontSize + 'px');

    // 创建日历顶部容器（头部+网格），固定不滚动
    const calendarContainer = document.createElement('div');
    calendarContainer.className = 'calendar-calendar-container';

    // 创建头部
    const header = this.createHeader();
    this.header = header;
    calendarContainer.appendChild(header);

    // 创建网格
    const grid = this.createGrid();
    this.grid = grid;
    calendarContainer.appendChild(grid);

    this.contentEl.appendChild(calendarContainer);

    // 创建笔记列表容器
    const notesList = this.createNotesList();
    this.notesList = notesList;
    this.contentEl.appendChild(notesList);

    // 确保DOM更新后再渲染
    requestAnimationFrame(() => {
      this.render();
    });

    this.container = this.contentEl;
  }

  /**
   * 创建头部
   */
  createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'calendar-header';

    // 左侧切换按钮组
    const leftNavGroup = document.createElement('div');
    leftNavGroup.className = 'calendar-nav-group calendar-nav-left';

    // 上一年按钮
    const prevYearBtn = document.createElement('button');
    prevYearBtn.className = 'calendar-btn calendar-nav-btn';
    prevYearBtn.textContent = '‹‹';
    prevYearBtn.onclick = () => {
      this.model.previousYear();
      this.render();
    };
    leftNavGroup.appendChild(prevYearBtn);

    // 上个月按钮
    const prevMonthBtn = document.createElement('button');
    prevMonthBtn.className = 'calendar-btn calendar-nav-btn';
    prevMonthBtn.textContent = '‹';
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

    // 今天按钮 — 先创建引用，后面塞入右侧导航组
    const todayBtn = document.createElement('button');
    todayBtn.className = 'calendar-btn calendar-today-btn';
    todayBtn.textContent = '今';
    todayBtn.onclick = () => {
      this.model.goToToday();
      this.todayBtn?.classList.add('calendar-today-btn-selected');
      this.render();
    };
    this.todayBtn = todayBtn;

    // 右侧切换按钮组（包含导航按钮和今按钮）
    const rightNavGroup = document.createElement('div');
    rightNavGroup.className = 'calendar-nav-group calendar-nav-right';

    // 今按钮 — 放在右侧导航组最前面
    rightNavGroup.appendChild(todayBtn);

    // 下个月按钮
    const nextMonthBtn = document.createElement('button');
    nextMonthBtn.className = 'calendar-btn calendar-nav-btn';
    nextMonthBtn.textContent = '›';
    nextMonthBtn.onclick = () => {
      this.model.nextMonth();
      this.render();
    };
    rightNavGroup.appendChild(nextMonthBtn);

    // 下一年按钮
    const nextYearBtn = document.createElement('button');
    nextYearBtn.className = 'calendar-btn calendar-nav-btn';
    nextYearBtn.textContent = '››';
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
  createGrid(): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';
    return grid;
  }

  /**
   * 更新网格
   */
  updateGrid(): void {
    const grid = this.grid;
    if (!grid) return;

    // 清空现有内容
    grid.innerHTML = '';

    // 获取日历数据
    const calendarData = this.model.getCalendarData();

    // 添加周数标题
    const weekNumberHeader = document.createElement('div');
    weekNumberHeader.className = 'calendar-week-number-header';
    weekNumberHeader.textContent = '周';
    grid.appendChild(weekNumberHeader);

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
      grid.appendChild(weekdayEl);
    });

    // 用于跟踪当前的周数
    let currentWeekNumber: number | null = null;
    let dayInRow = 0;

    // 渲染周数和日期
    calendarData.forEach((dayData) => {
      const solarDay = Solar.fromDate(dayData.date);
      const lunarDay = solarDay.getLunar();
      const holiday = HolidayUtil.getHoliday(dayData.date.getFullYear(), dayData.date.getMonth() + 1, dayData.date.getDate());
      if (dayData.date) {
        // 检查是否是每行的第一个日期
        if (dayInRow === 0) {
          // 为每行都计算周数，即使日期是上个月或下个月的
          const weekNumber = dayData.weekNumber !== null ? dayData.weekNumber : this.model.getWeekNumber(dayData.date);

          // 添加周数单元格
          const weekNumberCell = document.createElement('div');
          weekNumberCell.className = 'calendar-week-number';
          weekNumberCell.textContent = String(weekNumber);
          grid.appendChild(weekNumberCell);
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
        dayText.textContent = String(dayData.day);
        dayCell.appendChild(dayText);

        // 添加农历日期
        if (this.model.showLunarDate) {
          const lunarDayText = document.createElement('div');
          lunarDayText.className = 'calendar-day-lunar';
          const dayInChinese = lunarDay.getDayInChinese();
          // 如果是初一，显示月份
          if (dayInChinese === '初一') {
            lunarDayText.textContent = lunarDay.getMonthInChinese() + '月';
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

        grid.appendChild(dayCell);

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
  createNotesList(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'calendar-notes-list';

    // 创建标题容器（包含创建按钮和日期标题）
    const titleContainer = document.createElement('div');
    titleContainer.className = 'calendar-notes-title-container';

    // 使用抽提的按钮创建方法
    titleContainer.appendChild(this.createNoteButtonsGroup());

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
  updateNotesList(): void {
    const notesList = this.notesList;
    if (!notesList) return;

    // 清空笔记列表
    notesList.empty();

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

    // 使用抽提的按钮创建方法
    titleContainer.appendChild(this.createNoteButtonsGroup());

    // 创建日期标题
    const titleEl = document.createElement('div');
    titleEl.className = 'calendar-notes-title';
    titleEl.textContent = `${year}年${month}月${day}日`;
    titleContainer.appendChild(titleEl);

    // 获取该日期的笔记列表
    const notes = this.model.getNotesForDate(dateStr);
    console.log(`[NoteCalendar] 更新笔记列表，日期: ${dateStr}, 笔记数量: ${notes.length}`);

    // 数量统计（仅在有笔记时显示，置于 header 最下层靠右）
    let statsEl: HTMLElement | null = null;
    if (notes.length > 0) {
      const createdCount = notes.filter(n => n.type === 'created').length;
      const updatedCount = notes.length - createdCount;
      const statsSpan = document.createElement('span');
      statsSpan.className = 'calendar-notes-stats';
      statsSpan.textContent = `共 ${notes.length} 篇 · 新建 ${createdCount} · 更新 ${updatedCount}`;
      statsEl = statsSpan;
    }

    // header 最下层副行：农历居左、统计靠右；无统计时农历保持居中
    const subRow = document.createElement('div');
    subRow.className = 'calendar-notes-sub';
    if (this.model.showLunarDate) {
      try {
        const solarDay = Solar.fromYmd(year, month, day);
        const lunarDay = solarDay.getLunar();
        const lunarStr = `${lunarDay.getYearInGanZhi()}${lunarDay.getYearShengXiao()}年 ${lunarDay.getMonthInChinese()}月${lunarDay.getDayInChinese()}`;
        const lunarEl = document.createElement('div');
        lunarEl.className = 'calendar-notes-lunar';
        lunarEl.textContent = lunarStr;
        subRow.appendChild(lunarEl);
      } catch (e) {
        // 农历解析失败时静默跳过
      }
    }
    if (statsEl) {
      subRow.appendChild(statsEl);
    }
    // 仅当副行有内容（农历或统计）时追加
    if (subRow.childNodes.length > 0) {
      titleContainer.appendChild(subRow);
    }

    notesList.appendChild(titleContainer);

    // 创建笔记列表容器
    const notesContainer = document.createElement('div');
    notesContainer.className = 'calendar-notes-items';

    if (notes.length > 0) {
      // 按更新时间倒序排列（最近更新的排前面）
      const sortedNotes = [...notes].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      sortedNotes.forEach(note => {
        const noteItem = document.createElement('div');
        noteItem.className = 'calendar-note-item';

        // 圆点（类型标识，左侧）
        const dot = document.createElement('div');
        dot.className = 'calendar-note-item-dot';
        if (note.type === 'created') {
          dot.classList.add('calendar-note-dot-created');
        } else {
          dot.classList.add('calendar-note-dot-updated');
        }
        noteItem.appendChild(dot);

        // 标题与路径（左部）
        const body = document.createElement('div');
        body.className = 'calendar-note-item-body';

        const titleSpan = document.createElement('div');
        titleSpan.className = 'calendar-note-item-title';
        titleSpan.textContent = note.title;
        body.appendChild(titleSpan);

        const pathSpan = document.createElement('div');
        pathSpan.className = 'calendar-note-item-path';
        pathSpan.textContent = note.path;
        pathSpan.title = note.path;
        body.appendChild(pathSpan);

        noteItem.appendChild(body);

        // 类型标签（新建 / 更新，右侧）
        const tag = document.createElement('span');
        tag.className = note.type === 'created'
          ? 'calendar-note-item-tag calendar-note-tag-created'
          : 'calendar-note-item-tag calendar-note-tag-updated';
        tag.textContent = note.type === 'created' ? '新建' : '更新';
        noteItem.appendChild(tag);

        // 添加点击事件
        noteItem.onclick = async () => {
          console.log(`[NoteCalendar] 点击笔记: ${note.path}`);
          // 打开笔记文件
          const file = this.app.vault.getAbstractFileByPath(note.path);
          if (file) {
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file as TFile);
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

    notesList.appendChild(notesContainer);
  }

  /**
   * 计算周数
   */
  getWeekNumber(date: Date): number {
    const target = new Date(date.valueOf());
    target.setDate(target.getDate() + 4 - (target.getDay() || 7));
    const yearStart = new Date(target.getFullYear(), 0, 1);
    return Math.ceil(((target.valueOf() - yearStart.valueOf()) / 86400000 + 1) / 7);
  }

  /**
   * 根据当前配置获取月份对应的季度名称
   * @param {number} month - 月份 1-12
   * @returns {string} 季度名称，如 "1季度" / "春季" / 自定义
   */
  getQuarterName(month: number): string {
    const startMonth = this.model.quarterStartMonth || 1;
    const adjustedIndex = Math.floor(((month - startMonth + 12) % 12) / 3);
    const mode = this.model.quarterlyMode || 'number';

    switch (mode) {
      case 'season': {
        const names = ['春季', '夏季', '秋季', '冬季'];
        return names[adjustedIndex] || `${adjustedIndex + 1}`;
      }
      case 'custom': {
        const raw = this.model.quarterlyCustomNames || '';
        const parsed = raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
        // 补齐或截断到恰好4个名称，确保下标越界时也有兜底
        const defaults = ['Q1', 'Q2', 'Q3', 'Q4'];
        const customNames: string[] = [];
        for (let i = 0; i < 4; i++) {
          customNames[i] = parsed[i] || defaults[i];
        }
        return customNames[adjustedIndex] || `${adjustedIndex + 1}`;
      }
      case 'number':
      default:
        return `${adjustedIndex + 1}`;
    }
  }

  /**
   * 根据笔记类型和日期生成笔记标题
   * @param {string} type - daily / weekly / monthly / quarterly / yearly
   * @param {Date} date - 日期对象
   * @returns {string} 格式化后的标题
   */
  generateNoteTitle(type: NoteType, date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    switch (type) {
      case 'weekly':
        return this.model.weeklyTitleFormat
          .replace('YYYY', String(year))
          .replace('{week}', String(this.getWeekNumber(date)));
      case 'monthly':
        return this.model.monthlyTitleFormat
          .replace('YYYY', String(year))
          .replace('MM', month);
      case 'quarterly':
        return this.model.quarterlyTitleFormat
          .replace('YYYY', String(year))
          .replace('{quarter}', this.getQuarterName(date.getMonth() + 1));
      case 'yearly':
        return this.model.yearlyTitleFormat
          .replace('YYYY', String(year));
      case 'daily':
      default:
        return this.model.dailyTitleFormat
          .replace('YYYY', String(year))
          .replace('MM', month)
          .replace('DD', day);
    }
  }

  /**
   * 创建笔记创建按钮组（公共方法，消除重复代码）
   */
  createNoteButtonsGroup(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'calendar-create-btn-group';

    const buttons: { text: string; title: string; type: NoteType }[] = [
      { text: '+', title: '创建日记', type: 'daily' },
      { text: '周', title: '创建周周记', type: 'weekly' },
      { text: '月', title: '创建月度笔记', type: 'monthly' },
      { text: '季', title: '创建季度笔记', type: 'quarterly' },
      { text: '年', title: '创建年度笔记', type: 'yearly' }
    ];

    buttons.forEach(({ text, title, type }) => {
      const btn = document.createElement('button');
      btn.className = 'calendar-create-note-btn';
      btn.textContent = text;
      btn.title = title;
      btn.onclick = () => this.showCreateNoteDialog(type);
      group.appendChild(btn);
    });

    return group;
  }

  /**
   * 显示创建笔记对话框
   */
  showCreateNoteDialog(type: NoteType = 'daily'): void {
    const selectedDate = this.model.selectedDate;
    if (!selectedDate) return;

    // 使用类型对应的格式生成默认标题
    const defaultTitle = this.generateNoteTitle(type, selectedDate);

    // 获取该类型对应的默认文件夹路径
    let defaultFolder = '';
    switch (type) {
      case 'daily': defaultFolder = this.model.dailyFolderPath || ''; break;
      case 'weekly': defaultFolder = this.model.weeklyFolderPath || ''; break;
      case 'monthly': defaultFolder = this.model.monthlyFolderPath || ''; break;
      case 'quarterly': defaultFolder = this.model.quarterlyFolderPath || ''; break;
      case 'yearly': defaultFolder = this.model.yearlyFolderPath || ''; break;
    }

    // 创建对话框
    const modal = new Modal(this.app);
    modal.titleEl.textContent = type === 'daily' ? '创建新笔记' :
      type === 'weekly' ? '创建周周记' :
      type === 'monthly' ? '创建月度笔记' :
      type === 'quarterly' ? '创建季度笔记' : '创建年度笔记';

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

    // 文件夹路径输入框（支持筛选和选择器）
    const folderDiv = document.createElement('div');
    folderDiv.style.display = 'flex';
    folderDiv.style.flexDirection = 'column';
    folderDiv.style.position = 'relative';

    const folderLabel = document.createElement('label');
    folderLabel.textContent = '文件夹路径:';
    folderLabel.style.marginBottom = '4px';
    folderDiv.appendChild(folderLabel);

    const folderInputWrap = document.createElement('div');
    folderInputWrap.style.display = 'flex';
    folderInputWrap.style.gap = '6px';

    const folderInput = document.createElement('input');
    folderInput.type = 'text';
    folderInput.value = defaultFolder;
    folderInput.placeholder = '例如: notes/日记';
    folderInput.style.flex = '1';
    folderInput.style.padding = '8px';
    folderInput.style.border = '1px solid var(--calendar-border)';
    folderInput.style.borderRadius = '4px';
    folderInput.style.backgroundColor = 'var(--calendar-bg)';
    folderInput.style.color = 'var(--calendar-text)';
    folderInputWrap.appendChild(folderInput);

    // 文件夹列表图标按钮
    const folderPickerBtn = document.createElement('button');
    folderPickerBtn.type = 'button';
    folderPickerBtn.textContent = '📁';
    folderPickerBtn.title = '选择文件夹';
    folderPickerBtn.style.padding = '8px 10px';
    folderPickerBtn.style.border = '1px solid var(--calendar-border)';
    folderPickerBtn.style.borderRadius = '4px';
    folderPickerBtn.style.backgroundColor = 'var(--calendar-bg)';
    folderPickerBtn.style.color = 'var(--calendar-text)';
    folderPickerBtn.style.cursor = 'pointer';
    folderPickerBtn.style.flexShrink = '0';
    folderInputWrap.appendChild(folderPickerBtn);

    folderDiv.appendChild(folderInputWrap);

    // 文件夹下拉列表
    const folderList = document.createElement('div');
    folderList.className = 'calendar-folder-list';
    folderList.style.display = 'none';
    folderDiv.appendChild(folderList);
    form.appendChild(folderDiv);

    // ===== 文件夹选择器逻辑 =====
    const expandedPaths = new Set<string>(); // 树状展开状态
    let listVisible = false;
    let activeIndex = -1;

    // 获取全部文件夹路径（缓存，排除根目录和隐藏目录）
    let allFolderPaths: string[] | null = null;
    const getFolderPaths = (): string[] => {
      if (!allFolderPaths) {
        // 排除根目录对象（其 path 可能是 '' 或 '/'，直接按对象排除最可靠）
        const rootPath = this.app.vault.getRoot().path;
        allFolderPaths = this.app.vault.getAllLoadedFiles()
          .filter(f => (f as TFolder).children !== undefined && f.path !== rootPath) // TFolder 才有 children
          .map(f => f.path)
          .filter(p => {
            if (!p || p === '/') return false;
            return !p.split('/').some(seg => seg && seg.startsWith('.'));
          });
      }
      return allFolderPaths;
    };

    // 构建文件夹树
    const buildTree = (paths: string[]) => {
      const root: { name: string; path: string; children: Map<string, any> } =
        { name: '', path: '', children: new Map() };
      paths.forEach(p => {
        const segs = p.split('/');
        let node = root;
        let cur = '';
        segs.forEach(s => {
          cur = cur ? `${cur}/${s}` : s;
          if (!node.children.has(s)) {
            node.children.set(s, { name: s, path: cur, children: new Map() });
          }
          node = node.children.get(s);
        });
      });
      return root;
    };

    const toggleFolderList = (show: boolean) => {
      listVisible = show;
      activeIndex = -1;
      if (show) {
        // 挂载到 body 上以 fixed 定位浮层展示，避免被弹窗裁剪产生内部滚动条
        const rect = folderInput.getBoundingClientRect();
        folderList.style.display = 'block';
        folderList.style.position = 'fixed';
        folderList.style.top = `${rect.bottom + 4}px`;
        folderList.style.left = `${rect.left}px`;
        folderList.style.width = `${Math.max(rect.width, 260)}px`;
        folderList.style.maxWidth = '70vw';
        if (folderList.parentElement !== document.body) {
          document.body.appendChild(folderList);
        }
        folderList.scrollTop = 0; // 重置滚动，避免沿用上次打开的残留位置
        // 预填配置路径时：先标记默认路径的祖先为展开，渲染后仅定位一次
        if (defaultFolder) {
          markExpandedPath(defaultFolder);
        }
        renderFolderList();
        if (defaultFolder) {
          scrollToPath(defaultFolder);
        }
      } else {
        folderList.style.display = 'none';
        if (folderList.parentElement === document.body) {
          document.body.removeChild(folderList);
        }
      }
    };

    // 渲染列表：空输入=树状懒加载，有输入=扁平筛选（保留滚动位置）
    const renderFolderList = () => {
      const filter = folderInput.value.trim();
      const prevScrollTop = folderList.scrollTop;
      folderList.empty();
      activeIndex = -1;

      if (!filter) {
        const tree = buildTree(getFolderPaths());
        const renderNode = (node: { name: string; path: string; children: Map<string, any> }, depth: number) => {
          node.children.forEach(child => {
            folderList.appendChild(createFolderRow(child, depth));
            if (expandedPaths.has(child.path)) {
              renderNode(child, depth + 1);
            }
          });
        };
        renderNode(tree, 0);
      } else {
        const matched = getFolderPaths().filter(p => p.includes(filter));
        if (matched.length > 0) {
          matched.forEach(p => {
            const row = document.createElement('div');
            row.className = 'calendar-folder-item';
            row.dataset.path = p;
            row.textContent = p;
            row.onclick = () => { folderInput.value = p; toggleFolderList(false); };
            folderList.appendChild(row);
          });
        } else {
          const empty = document.createElement('div');
          empty.className = 'calendar-folder-empty';
          empty.textContent = '无匹配文件夹';
          folderList.appendChild(empty);
        }
      }
      // 恢复渲染前的滚动位置，避免展开/收起时列表跳动
      folderList.scrollTop = prevScrollTop;
    };

    // 树节点行（带展开箭头，箭头热区放大便于点击）
    const createFolderRow = (child: { name: string; path: string; children: Map<string, any> }, depth: number) => {
      const row = document.createElement('div');
      row.className = 'calendar-folder-item';
      row.dataset.path = child.path;
      row.style.paddingLeft = `${depth * 16 + 2}px`;

      const arrow = document.createElement('span');
      arrow.className = 'calendar-folder-arrow';
      if (child.children.size > 0) {
        arrow.textContent = expandedPaths.has(child.path) ? '▾' : '▸';
        arrow.title = expandedPaths.has(child.path) ? '收起' : '展开';
        arrow.onclick = (e) => {
          e.stopPropagation();
          if (expandedPaths.has(child.path)) {
            expandedPaths.delete(child.path);
          } else {
            expandedPaths.add(child.path);
          }
          renderFolderList();
          // 展开/收起后确保该节点仍在可视区域内
          const rowEl = folderList.querySelector(`[data-path="${child.path}"]`);
          if (rowEl) {
            rowEl.scrollIntoView({ block: 'nearest' });
          }
        };
      } else {
        // 无子级的节点：占位保持对齐，不可点击
        arrow.classList.add('calendar-folder-arrow-placeholder');
      }
      row.appendChild(arrow);

      const name = document.createElement('span');
      name.textContent = child.name;
      row.appendChild(name);

      row.onclick = () => {
        folderInput.value = child.path;
        toggleFolderList(false);
      };

      return row;
    };

    // 标记路径及其所有祖先为展开状态（不渲染，需配合 renderFolderList）
    const markExpandedPath = (path: string) => {
      const segs = path.split('/').filter(Boolean);
      let cur = '';
      segs.forEach(s => {
        cur = cur ? `${cur}/${s}` : s;
        expandedPaths.add(cur);
      });
    };

    // 定位并高亮指定路径（仅列表打开时调用一次）
    const scrollToPath = (path: string) => {
      const target = folderList.querySelector(`[data-path="${path}"]`);
      if (target) {
        target.classList.add('calendar-folder-item-selected');
        target.scrollIntoView({ block: 'center' });
      }
    };

    // 键盘导航
    const getVisibleItems = (): HTMLElement[] => Array.from(folderList.querySelectorAll<HTMLElement>('.calendar-folder-item'));
    const moveActive = (delta: number) => {
      const items = getVisibleItems();
      if (items.length === 0) return;
      activeIndex = (activeIndex + delta + items.length) % items.length;
      items.forEach((el, i) => el.classList.toggle('calendar-folder-item-active', i === activeIndex));
      items[activeIndex].scrollIntoView({ block: 'nearest' });
    };

    // 输入时自动筛选
    folderInput.addEventListener('input', () => {
      if (folderInput.value.trim().length > 0) {
        if (!listVisible) toggleFolderList(true);
        else renderFolderList();
      } else if (listVisible) {
        renderFolderList();
      }
    });

    // 键盘操作：↑↓移动 Enter确认 Esc关闭（不关闭弹窗）
    folderInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (!listVisible) toggleFolderList(true); else moveActive(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (!listVisible) toggleFolderList(true); else moveActive(-1); }
      else if (e.key === 'Enter') {
        if (listVisible) {
          e.preventDefault();
          const items = getVisibleItems();
          if (activeIndex >= 0 && items[activeIndex]) {
            // 有高亮项：选择该项
            items[activeIndex].click();
          } else {
            // 无高亮项：确认当前输入值（如空=根目录），关闭列表
            toggleFolderList(false);
          }
        }
      }
    });

    // 图标按钮：显示/关闭文件夹列表
    folderPickerBtn.onclick = () => {
      if (listVisible) {
        toggleFolderList(false);
      } else {
        toggleFolderList(true);
      }
    };

    // 点击外部关闭列表
    const outsideHandler = (e: MouseEvent) => {
      if (listVisible && !folderDiv.contains(e.target as Node) && !folderList.contains(e.target as Node)) {
        toggleFolderList(false);
      }
    };
    document.addEventListener('mousedown', outsideHandler);
    modal.onClose = () => {
      document.removeEventListener('mousedown', outsideHandler);
      if (folderList.parentElement === document.body) {
        document.body.removeChild(folderList);
      }
    };

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

    // 阻止 Enter 触发表单默认提交（页面刷新），由确认按钮统一处理
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      confirmBtn.click();
    });

    modal.contentEl.appendChild(form);
    modal.open();
  }

  /**
   * 创建笔记
   */
  async createNote(title: string, folderPath: string, type: NoteType): Promise<void> {
    try {
      // 构建文件路径
      let filePath: string;
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

      // 逐级检查并创建不存在的文件夹
      if (folderPath) {
        const folderParts = folderPath.split('/');
        let currentPath = '';

        for (const part of folderParts) {
          if (!part) continue;
          currentPath = currentPath ? currentPath + '/' + part : part;

          // 不带末尾斜杠查找，避免 getAbstractFileByPath 找不到已存在的文件夹
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
  getFontFamilyValue(): string {
    const fontMap: Record<string, string> = {
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
  applyStyles(): void {
    if (!this.contentEl) return;
    this.contentEl.style.setProperty('--calendar-weekend-color', this.model.weekendColor);
    // 主题色：跟随 Obsidian 强调色时直接引用其 CSS 变量，可实时跟随外观设置中的强调色
    this.contentEl.style.setProperty('--calendar-primary',
      this.model.followAccentColor ? 'var(--interactive-accent)' : this.model.themeColor);
    // hover 深色与 hover 背景基于主题色动态生成，通过 JS 内联设置（不依赖 styles.css 重载，确保生效）
    this.contentEl.style.setProperty('--calendar-primary-hover', 'color-mix(in srgb, var(--calendar-primary) 85%, black)');
    this.contentEl.style.setProperty('--calendar-hover', 'color-mix(in srgb, var(--calendar-primary) 10%, transparent)');
    this.contentEl.style.setProperty('--calendar-font-family', this.getFontFamilyValue());
    this.contentEl.style.setProperty('--calendar-font-size', this.model.fontSize + 'px');

    // 根据主题模式切换 CSS class
    const themeMode = this.model.themeMode || 'auto';
    this.contentEl.classList.remove('calendar-theme-dark', 'calendar-theme-light');
    if (themeMode === 'dark') {
      this.contentEl.classList.add('calendar-theme-dark');
    } else if (themeMode === 'light') {
      this.contentEl.classList.add('calendar-theme-light');
    }
    // auto 模式不添加任何 class，使用 :root 中定义的默认变量跟随 Obsidian
  }

  /**
   * 更新今天按钮的状态
   */
  updateTodayButtonState(): void {
    const todayBtn = this.todayBtn;
    if (!todayBtn) return;

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

    const hasSelectedClass = todayBtn.classList.contains('calendar-today-btn-selected');

    if (isTodaySelected && !hasSelectedClass) {
      todayBtn.classList.add('calendar-today-btn-selected');
    } else if (!isTodaySelected && hasSelectedClass) {
      todayBtn.classList.remove('calendar-today-btn-selected');
    }
  }

  /**
   * 渲染日历
   */
  render(): void {
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
  updateHeader(): void {
    if (this.titleEl && this.lunarTitleEl) {
      const { year, month } = this.model.getViewDate();
      // 第一行：公历年月 + 季度
      let titleText = `${year}年 ${String(month).padStart(2, '0')}月`;
      if (this.model.showQuarterly) {
        const quarterName = this.getQuarterName(month);
        const mode = this.model.quarterlyMode || 'number';
        titleText += mode === 'number' ? ` ${quarterName}季度` : ` ${quarterName}`;
      }
      this.titleEl.textContent = titleText;
      // 第二行：农历年月
      if (this.model.showLunarDate) {
        const lunarDay = Solar.fromYmd(year, month, 1).getLunar();
        const str = lunarDay.getYearInGanZhi() + lunarDay.getYearShengXiao() + '年 ' + lunarDay.getMonthInChinese() + '月';
        this.lunarTitleEl.textContent = str;
      } else {
        this.lunarTitleEl.textContent = '';
      }
    }
  }

  /**
   * 创建日期单元格
   */
  createDayCell(dayData: CalendarDayData): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    cell.textContent = String(dayData.day);

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

  async onClose(): Promise<void> {
    // 视图关闭时的清理工作
  }
}
