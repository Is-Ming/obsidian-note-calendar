import { App, Modal, Notice, PluginSettingTab, Setting, TFile } from 'obsidian';
import { FolderPickerModal } from './folder-picker';
import { isTemplaterAvailable } from './templater';
import type NoteCalendarPlugin from './main';
import type { NoteCalendarSettings } from './types';

/**
 * 模板路径设置键（五类笔记各一）
 */
type TemplatePathKey =
  | 'dailyTemplatePath'
  | 'weeklyTemplatePath'
  | 'quarterlyTemplatePath'
  | 'yearlyTemplatePath'
  | 'monthlyTemplatePath';

/**
 * 默认设置
 */
export const DEFAULT_SETTINGS: NoteCalendarSettings = {
  startOfWeek: 0, // 0=周日, 1=周一
  weekendColor: '#e57373', // 周六周日的默认颜色，柔和玫瑰色
  themeColor: '#5d4ed8', // 主题颜色，默认为紫色
  followAccentColor: false, // 是否跟随 Obsidian 强调色
  themeMode: 'auto', // 主题模式：auto=跟随Obsidian, dark=深色, light=浅色
  showLunarDate: true, // 是否显示农历日期
  showSolarFestivals: true, // 是否显示阳历节日
  showLunarFestivals: true, // 是否显示农历节日
  showHolidayMarker: true, // 是否显示调休
  showJieQi: true, // 是否显示节气
  noteFolderPath: '', // 笔记扫描目录，留空=扫描整个仓库
  dateFormat: 'YYYY-MM-DD', // （已废弃，仅用于迁移到 dailyTitleFormat）
  fontFamily: 'default', // 字体
  fontSize: 14, // 字号：10-20px，默认14px
  // 各类型笔记的标题格式和默认路径（v0.3.4 新增）
  dailyTitleFormat: 'YYYY-MM-DD',
  dailyFolderPath: '',
  weeklyTitleFormat: 'YYYY-{week}周',
  weeklyFolderPath: '',
  quarterlyTitleFormat: 'YYYY年-{quarter}季度',
  quarterlyFolderPath: '',
  yearlyTitleFormat: 'YYYY',
  yearlyFolderPath: '',
  monthlyTitleFormat: 'YYYY年MM月',
  monthlyFolderPath: '',
  // 各类型笔记的 Templater 模板路径（留空=创建空笔记）
  dailyTemplatePath: '',
  weeklyTemplatePath: '',
  quarterlyTemplatePath: '',
  yearlyTemplatePath: '',
  monthlyTemplatePath: '',
  // 季度显示配置（v0.3.5 新增）
  showQuarterly: true,
  quarterlyMode: 'number', // 'number' | 'season' | 'custom'
  quarterStartMonth: 1, // 1-12，首个季的起始月
  quarterlyCustomNames: '春季,夏季,秋季,冬季'
};

/**
 * 设置面板类
 */
export class CalendarSettingTab extends PluginSettingTab {
  plugin: NoteCalendarPlugin;

  constructor(app: App, plugin: NoteCalendarPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // 注意：不要在设置页顶部创建插件名标题，Obsidian 已在标签页头部显示插件名
    // （Obsidian 审核规范：Avoid including the plugin name in settings headings）

    // ========== 外观 ==========
    const appearanceSection = this.createSection('外观');

    new Setting(appearanceSection)
      .setName('主题模式')
      .setDesc('选择日历背景主题模式。跟随Obsidian将自动适配深色/浅色主题')
      .addDropdown(dropdown => dropdown
        .addOption('auto', '跟随Obsidian')
        .addOption('dark', '深色')
        .addOption('light', '浅色')
        .setValue(this.plugin.settings.themeMode || 'auto')
        .onChange(async (value) => {
          await this.plugin.updateSettings({ themeMode: value as 'auto' | 'dark' | 'light' });
        }));

    new Setting(appearanceSection)
      .setName('一周起始日')
      .setDesc('选择日历一周的第一天是周日还是周一')
      .addDropdown(dropdown => dropdown
        .addOption('0', '周日')
        .addOption('1', '周一')
        .setValue(String(this.plugin.settings.startOfWeek))
        .onChange(async (value) => {
          await this.plugin.updateSettings({ startOfWeek: parseInt(value) as 0 | 1 });
        }));

    new Setting(appearanceSection)
      .setName('周末颜色')
      .setDesc('周六和周日显示的颜色')
      .addExtraButton(button => button
        .setIcon('reset')
        .setTooltip('重置为默认颜色')
        .onClick(() => {
          this.showResetConfirm('周末颜色', 'weekendColor', DEFAULT_SETTINGS.weekendColor);
        }))
      .addColorPicker(colorPicker => colorPicker
        .setValue(this.plugin.settings.weekendColor)
        .onChange(async (value) => {
          await this.plugin.updateSettings({ weekendColor: value });
        }));

    new Setting(appearanceSection)
      .setName('跟随 Obsidian 强调色')
      .setDesc('开启后主题色实时跟随 Obsidian 的强调色（设置 → 外观 → 强调色），并隐藏下方的主题颜色配置项')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.followAccentColor)
        .onChange(async (value) => {
          await this.plugin.updateSettings({ followAccentColor: value });
          this.display();
        }));

    // 跟随强调色时隐藏主题颜色配置项
    if (!this.plugin.settings.followAccentColor) {
      new Setting(appearanceSection)
        .setName('主题颜色')
        .setDesc('今天、选中状态和节假日的显示颜色')
        .addExtraButton(button => button
          .setIcon('reset')
          .setTooltip('重置为默认颜色')
          .onClick(() => {
            this.showResetConfirm('主题颜色', 'themeColor', DEFAULT_SETTINGS.themeColor);
          }))
        .addColorPicker(colorPicker => colorPicker
          .setValue(this.plugin.settings.themeColor)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ themeColor: value });
          }));
    }

    new Setting(appearanceSection)
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
          await this.plugin.updateSettings({ fontFamily: value });
        }));

    new Setting(appearanceSection)
      .setName('字号')
      .setDesc('设置日历文字大小（10-20px）')
      .addSlider(slider => slider
        .setLimits(10, 20, 1)
        .setValue(this.plugin.settings.fontSize)
        .setDynamicTooltip()
        .onChange(async (value) => {
          await this.plugin.updateSettings({ fontSize: Math.round(value) });
        }));

    // ========== 显示 ==========
    const displaySection = this.createSection('显示');

    new Setting(displaySection)
      .setName('显示公历假日')
      .setDesc('关闭后不再显示公历假日')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.showSolarFestivals)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ showSolarFestivals: value });
          });
      });

    new Setting(displaySection)
      .setName('显示调休')
      .setDesc('关闭后不再显示调休')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.showHolidayMarker)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ showHolidayMarker: value });
          });
      });

    new Setting(displaySection)
      .setName('显示农历日期')
      .setDesc('关闭后不再显示农历日期、月份、年份')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.showLunarDate)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ showLunarDate: value });
          });
      });

    new Setting(displaySection)
      .setName('显示农历假日')
      .setDesc('关闭后不再显示农历假日')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.showLunarFestivals)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ showLunarFestivals: value });
          });
      });

    new Setting(displaySection)
      .setName('显示节气')
      .setDesc('关闭后不再显示节气')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.showJieQi)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ showJieQi: value });
          });
      });

    new Setting(displaySection)
      .setName('显示季度')
      .setDesc('在日历标题中显示当前季度')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.showQuarterly)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ showQuarterly: value });
          });
      });

    // ========== 季度显示设置 ==========
    const quarterSection = this.createSection('季度显示设置');

    const currentMode = this.plugin.settings.quarterlyMode || 'number';
    new Setting(quarterSection)
      .setName('季度显示模式')
      .setDesc('选择季度的显示方式')
      .addDropdown(dropdown => dropdown
        .addOption('number', '数字（1季度、2季度…）')
        .addOption('season', '春夏秋冬（春季、夏季…）')
        .addOption('custom', '自定义命名')
        .setValue(currentMode)
        .onChange(async (value) => {
          await this.plugin.updateSettings({ quarterlyMode: value as 'number' | 'season' | 'custom' });
          this.display();
        }));

    if (currentMode === 'season' || currentMode === 'custom') {
      new Setting(quarterSection)
        .setName('首季起始月份')
        .setDesc('设置第一个季度从哪个月开始')
        .addDropdown(dropdown => {
          for (let i = 1; i <= 12; i++) {
            dropdown.addOption(String(i), `${i}月`);
          }
          dropdown.setValue(String(this.plugin.settings.quarterStartMonth || 1))
            .onChange(async (value) => {
              await this.plugin.updateSettings({ quarterStartMonth: parseInt(value) });
            });
        });
    }

    if (currentMode === 'custom') {
      new Setting(quarterSection)
        .setName('自定义季度名称')
        .setDesc('用逗号分隔四个季度的名称，需恰好4个。例如：Q1,Q2,Q3,Q4')
        .addText(text => text
          .setPlaceholder('春季,夏季,秋季,冬季')
          .setValue(this.plugin.settings.quarterlyCustomNames)
          .onChange(async (value) => {
            const count = value.split(',').filter(s => s.trim().length > 0).length;
            if (count > 0 && count !== 4) {
              new Notice(`当前输入了 ${count} 个名称，季度需要恰好 4 个，不足部分将自动补齐`);
            }
            await this.plugin.updateSettings({ quarterlyCustomNames: value });
          }));
    }

    // ========== 日记设置 ==========
    const dailySection = this.createSection('日记设置');

    new Setting(dailySection)
      .setName('标题格式')
      .setDesc('支持 YYYY（年份）、MM（月份）、DD（日期）')
      .addText(text => text
        .setPlaceholder('YYYY-MM-DD')
        .setValue(this.plugin.settings.dailyTitleFormat)
        .onChange(async (value) => {
          await this.plugin.updateSettings({ dailyTitleFormat: value });
        }));

    let dailyFolderInput: HTMLInputElement | null = null;
    new Setting(dailySection)
      .setName('默认文件夹路径')
      .setDesc('创建日记时的默认保存路径（留空为根目录）')
      .addText(text => {
        dailyFolderInput = text.inputEl;
        text.setPlaceholder('例如: notes/日记')
          .setValue(this.plugin.settings.dailyFolderPath)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ dailyFolderPath: value });
          });
      })
      .addExtraButton(button => button
        .setIcon('folder')
        .setTooltip('选择文件夹')
        .onClick(() => this.showFolderPicker('dailyFolderPath', dailyFolderInput!, '选择日记默认文件夹')));

    this.createTemplateSetting(dailySection, '日记', 'dailyTemplatePath');

    // ========== 周记设置 ==========
    const weeklySection = this.createSection('周记设置');

    new Setting(weeklySection)
      .setName('标题格式')
      .setDesc('支持 YYYY（年份）、{week}（周数），例如：YYYY-{week}周')
      .addText(text => text
        .setPlaceholder('YYYY-{week}周')
        .setValue(this.plugin.settings.weeklyTitleFormat)
        .onChange(async (value) => {
          await this.plugin.updateSettings({ weeklyTitleFormat: value });
        }));

    let weeklyFolderInput: HTMLInputElement | null = null;
    new Setting(weeklySection)
      .setName('默认文件夹路径')
      .setDesc('创建周记时的默认保存路径（留空为根目录）')
      .addText(text => {
        weeklyFolderInput = text.inputEl;
        text.setPlaceholder('例如: notes/周记')
          .setValue(this.plugin.settings.weeklyFolderPath)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ weeklyFolderPath: value });
          });
      })
      .addExtraButton(button => button
        .setIcon('folder')
        .setTooltip('选择文件夹')
        .onClick(() => this.showFolderPicker('weeklyFolderPath', weeklyFolderInput!, '选择周记默认文件夹')));

    this.createTemplateSetting(weeklySection, '周记', 'weeklyTemplatePath');

    // ========== 季度笔记设置 ==========
    const quarterlySection = this.createSection('季度笔记设置');

    new Setting(quarterlySection)
      .setName('标题格式')
      .setDesc('支持 YYYY（年份）、{quarter}（季度），例如：YYYY年-{quarter}季度')
      .addText(text => text
        .setPlaceholder('YYYY年-{quarter}季度')
        .setValue(this.plugin.settings.quarterlyTitleFormat)
        .onChange(async (value) => {
          await this.plugin.updateSettings({ quarterlyTitleFormat: value });
        }));

    let quarterlyFolderInput: HTMLInputElement | null = null;
    new Setting(quarterlySection)
      .setName('默认文件夹路径')
      .setDesc('创建季度笔记时的默认保存路径（留空为根目录）')
      .addText(text => {
        quarterlyFolderInput = text.inputEl;
        text.setPlaceholder('例如: notes/季度')
          .setValue(this.plugin.settings.quarterlyFolderPath)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ quarterlyFolderPath: value });
          });
      })
      .addExtraButton(button => button
        .setIcon('folder')
        .setTooltip('选择文件夹')
        .onClick(() => this.showFolderPicker('quarterlyFolderPath', quarterlyFolderInput!, '选择季度笔记默认文件夹')));

    this.createTemplateSetting(quarterlySection, '季度笔记', 'quarterlyTemplatePath');

    // ========== 月度笔记设置 ==========
    const monthlySection = this.createSection('月度笔记设置');

    new Setting(monthlySection)
      .setName('标题格式')
      .setDesc('支持 YYYY（年份）、MM（月份），例如：YYYY年MM月')
      .addText(text => text
        .setPlaceholder('YYYY年MM月')
        .setValue(this.plugin.settings.monthlyTitleFormat)
        .onChange(async (value) => {
          await this.plugin.updateSettings({ monthlyTitleFormat: value });
        }));

    let monthlyFolderInput: HTMLInputElement | null = null;
    new Setting(monthlySection)
      .setName('默认文件夹路径')
      .setDesc('创建月度笔记时的默认保存路径（留空为根目录）')
      .addText(text => {
        monthlyFolderInput = text.inputEl;
        text.setPlaceholder('例如: notes/月度')
          .setValue(this.plugin.settings.monthlyFolderPath)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ monthlyFolderPath: value });
          });
      })
      .addExtraButton(button => button
        .setIcon('folder')
        .setTooltip('选择文件夹')
        .onClick(() => this.showFolderPicker('monthlyFolderPath', monthlyFolderInput!, '选择月度笔记默认文件夹')));

    this.createTemplateSetting(monthlySection, '月度笔记', 'monthlyTemplatePath');

    // ========== 年度笔记设置 ==========
    const yearlySection = this.createSection('年度笔记设置');

    new Setting(yearlySection)
      .setName('标题格式')
      .setDesc('支持 YYYY（年份），例如：YYYY')
      .addText(text => text
        .setPlaceholder('YYYY')
        .setValue(this.plugin.settings.yearlyTitleFormat)
        .onChange(async (value) => {
          await this.plugin.updateSettings({ yearlyTitleFormat: value });
        }));

    let yearlyFolderInput: HTMLInputElement | null = null;
    new Setting(yearlySection)
      .setName('默认文件夹路径')
      .setDesc('创建年度笔记时的默认保存路径（留空为根目录）')
      .addText(text => {
        yearlyFolderInput = text.inputEl;
        text.setPlaceholder('例如: notes/年度')
          .setValue(this.plugin.settings.yearlyFolderPath)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ yearlyFolderPath: value });
          });
      })
      .addExtraButton(button => button
        .setIcon('folder')
        .setTooltip('选择文件夹')
        .onClick(() => this.showFolderPicker('yearlyFolderPath', yearlyFolderInput!, '选择年度笔记默认文件夹')));

    this.createTemplateSetting(yearlySection, '年度笔记', 'yearlyTemplatePath');

    // ========== 笔记扫描 ==========
    const scanSection = this.createSection('笔记扫描');

    let noteFolderInput: HTMLInputElement | null = null;
    new Setting(scanSection)
      .setName('扫描目录')
      .setDesc('设置只扫描该目录下的笔记文件用于日历显示，留空则扫描整个仓库。此设置仅影响哪些笔记会被显示在日历上，与创建笔记时的默认保存路径无关。')
      .addText(text => {
        noteFolderInput = text.inputEl;
        text.setPlaceholder('留空扫描全部')
          .setValue(this.plugin.settings.noteFolderPath)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ noteFolderPath: value });
          });
      })
      .addExtraButton(button => button
        .setIcon('folder')
        .setTooltip('选择文件夹')
        .onClick(() => this.showFolderPicker('noteFolderPath', noteFolderInput!, '选择扫描目录')));

    new Setting(scanSection)
      .setName('手动扫描')
      .setDesc('点击按钮立即重新扫描所有笔记')
      .addButton(button => button
        .setButtonText('扫描')
        .onClick(async () => {
          await this.plugin.scanNotes();
        }));

    // ========== 一键恢复默认 ==========
    new Setting(containerEl)
      .setClass('calendar-reset-all-btn')
      .setName('恢复默认设置')
      .setDesc('将所有设置恢复为默认值（主题、显示、季度、笔记路径与格式等全部配置）')
      .addButton(button => button
        .setButtonText('恢复默认')
        .setWarning()
        .onClick(() => this.showResetAllConfirm()));
  }

  /**
   * 创建可收起的设置分组
   * @param {string} title 分组标题
   * @returns {HTMLElement} 分组容器，后续 Setting 应添加到该容器中
   */
  createSection(title: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'calendar-settings-section';

    // 使用 Setting.setHeading() 创建分组标题（符合 Obsidian 设置页规范），再附加收起交互
    // settingEl 即分组标题行，挂上自定义类名复用原有收起/箭头样式
    const header = new Setting(section).setName(title).setHeading().settingEl;
    header.classList.add('calendar-settings-section-title');
    header.onclick = () => {
      section.classList.toggle('calendar-settings-section-collapsed');
    };
    this.containerEl.appendChild(section);
    return section;
  }

  /**
   * 打开文件夹选择弹窗，选择后自动填充到配置项并保存
   * @param {string} key 设置键名
   * @param {HTMLInputElement} inputEl 配置项对应的文本输入框
   * @param {string} title 弹窗标题
   */
  showFolderPicker(key: keyof NoteCalendarSettings, inputEl: HTMLInputElement, title: string): void {
    new FolderPickerModal(this.app, {
      title,
      initialPath: this.plugin.settings[key] as string,
      onChoose: async (path) => {
        inputEl.value = path;
        await this.plugin.updateSettings({ [key]: path } as Partial<NoteCalendarSettings>);
      }
    }).open();
  }

  /**
   * 创建"模板文件"设置项（五类笔记设置组共用）
   * @param {HTMLElement} section 所属分组容器
   * @param {string} label 笔记类型名称（用于文案）
   * @param {TemplatePathKey} key 模板路径设置键
   */
  createTemplateSetting(section: HTMLElement, label: string, key: TemplatePathKey): void {
    const templaterReady = isTemplaterAvailable(this.app);
    let templateInput: HTMLInputElement | null = null;

    new Setting(section)
      .setName('模板文件')
      .setDesc(
        `创建${label}时自动套用 Templater 模板，留空则创建空笔记。\n` +
        (templaterReady ? '' : '当前未检测到已启用的 Templater 插件，填写后暂不生效。\n') +
        '建议避免同时启用 Templater 的"文件夹模板"指向同一目录，否则插件会自动跳过套用以避免内容重复。'
      )
      .addText(text => {
        templateInput = text.inputEl;
        text.setPlaceholder('例如: templates/模板')
          .setValue(this.plugin.settings[key])
          .onChange(async (value) => {
            await this.plugin.updateSettings({ [key]: value } as Partial<NoteCalendarSettings>);
            this.updateTemplateInputState(templateInput!, value);
          });
      })
      .addExtraButton(button => button
        .setIcon('file')
        .setTooltip('选择模板文件')
        .onClick(() => this.showFilePicker(key, templateInput!, `选择${label}模板文件`)));

    // 初始校验一次：路径错误时红色边框提示
    this.updateTemplateInputState(templateInput!, this.plugin.settings[key]);
  }

  /**
   * 模板路径存在性校验：非空且文件不存在时输入框显示红色边框
   * @param {HTMLInputElement} inputEl 模板路径输入框
   * @param {string} path 当前路径值
   */
  updateTemplateInputState(inputEl: HTMLInputElement, path: string): void {
    const trimmed = path.trim();
    const invalid = trimmed !== ''
      && !(this.app.vault.getAbstractFileByPath(trimmed) instanceof TFile);
    inputEl.setCssStyles({ borderColor: invalid ? '#e57373' : '' });
  }

  /**
   * 打开模板文件选择弹窗（file 模式，树中可选 .md 文件），选择后自动填充并保存
   * @param {TemplatePathKey} key 设置键名
   * @param {HTMLInputElement} inputEl 配置项对应的文本输入框
   * @param {string} title 弹窗标题
   */
  showFilePicker(key: TemplatePathKey, inputEl: HTMLInputElement, title: string): void {
    new FolderPickerModal(this.app, {
      title,
      initialPath: this.plugin.settings[key],
      mode: 'file',
      onChoose: async (path) => {
        inputEl.value = path;
        await this.plugin.updateSettings({ [key]: path } as Partial<NoteCalendarSettings>);
        this.updateTemplateInputState(inputEl, path);
      }
    }).open();
  }

  /**
   * 显示重置确认弹窗
   * @param {string} label 设置项名称，如"周末颜色"
   * @param {string} key 设置键名
   * @param {string} defaultValue 默认值
   */
  showResetConfirm(label: string, key: keyof NoteCalendarSettings, defaultValue: string): void {
    const modal = new Modal(this.app);
    modal.titleEl.textContent = `重置${label}`;

    const content = modal.contentEl;
    content.setCssStyles({ display: 'flex', flexDirection: 'column', gap: '16px' });

    const desc = document.createElement('p');
    desc.textContent = `确定要将${label}重置为默认值吗？`;
    desc.setCssStyles({ margin: '0' });
    content.appendChild(desc);

    const buttonContainer = document.createElement('div');
    buttonContainer.setCssStyles({ display: 'flex', justifyContent: 'flex-end', gap: '8px' });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.setCssStyles({ padding: '8px 16px', border: '1px solid var(--background-modifier-border)', borderRadius: '4px', background: 'var(--background-secondary)', color: 'var(--text-normal)', cursor: 'pointer' });
    cancelBtn.onclick = () => modal.close();
    buttonContainer.appendChild(cancelBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '确认重置';
    confirmBtn.setCssStyles({ padding: '8px 16px', border: 'none', borderRadius: '4px', background: 'var(--calendar-primary)', color: '#ffffff', cursor: 'pointer' });
    confirmBtn.onclick = async () => {
      await this.plugin.updateSettings({ [key]: defaultValue } as Partial<NoteCalendarSettings>);
      this.display();
      modal.close();
      new Notice(`${label}已重置为默认`);
    };
    buttonContainer.appendChild(confirmBtn);

    content.appendChild(buttonContainer);
    modal.open();
  }

  /**
   * 显示"恢复全部默认"确认弹窗
   */
  showResetAllConfirm(): void {
    const modal = new Modal(this.app);
    modal.titleEl.textContent = '恢复默认设置';

    const content = modal.contentEl;
    content.setCssStyles({ display: 'flex', flexDirection: 'column', gap: '16px' });

    const desc = document.createElement('p');
    desc.textContent = '确定要将所有设置恢复为默认值吗？此操作将覆盖当前全部配置。';
    desc.setCssStyles({ margin: '0' });
    content.appendChild(desc);

    const buttonContainer = document.createElement('div');
    buttonContainer.setCssStyles({ display: 'flex', justifyContent: 'flex-end', gap: '8px' });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.setCssStyles({ padding: '8px 16px', border: '1px solid var(--background-modifier-border)', borderRadius: '4px', background: 'var(--background-secondary)', color: 'var(--text-normal)', cursor: 'pointer' });
    cancelBtn.onclick = () => modal.close();
    buttonContainer.appendChild(cancelBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '确认恢复';
    confirmBtn.setCssStyles({ padding: '8px 16px', border: 'none', borderRadius: '4px', background: 'var(--calendar-primary)', color: '#ffffff', cursor: 'pointer' });
    confirmBtn.onclick = async () => {
      await this.plugin.updateSettings({ ...DEFAULT_SETTINGS });
      this.display();
      modal.close();
      new Notice('所有设置已恢复为默认');
    };
    buttonContainer.appendChild(confirmBtn);

    content.appendChild(buttonContainer);
    modal.open();
  }
}
