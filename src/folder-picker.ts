import { App, Modal, TFolder } from 'obsidian';

/**
 * 文件夹选择器配置项
 */
export interface FolderPickerOptions {
  /** 弹窗标题 */
  title: string;
  /** 初始路径（用于展开并定位到该文件夹，可留空） */
  initialPath?: string;
  /** 选择文件夹后的回调（选择后自动关闭弹窗），path 为空字符串表示根目录 */
  onChoose: (path: string) => void;
}

/**
 * 文件夹树节点
 */
interface FolderNode {
  name: string;
  path: string;
  children: Map<string, FolderNode>;
}

/**
 * 文件夹选择弹窗
 * 交互逻辑与创建笔记弹窗中的文件夹选择器一致（4.4）：
 * - 空输入时树状懒加载，可展开/收起子文件夹
 * - 输入时自动筛选（匹配名称中包含输入内容的文件夹）
 * - 支持键盘上下键导航、Enter 确认、Esc 关闭
 * - 点击某个文件夹后自动回调并关闭弹窗
 */
export class FolderPickerModal extends Modal {
  private options: FolderPickerOptions;
  private input!: HTMLInputElement;
  private list!: HTMLDivElement;
  private expandedPaths = new Set<string>();
  private allFolderPaths: string[] | null = null;
  private activeIndex = -1;

  constructor(app: App, options: FolderPickerOptions) {
    super(app);
    this.options = options;
  }

  onOpen(): void {
    const { titleEl, contentEl } = this;
    titleEl.textContent = this.options.title;

    // 弹窗宽度适配 Obsidian 主题
    this.modalEl.style.width = '480px';
    contentEl.empty();

    // 输入区：筛选输入框 + 清除按钮
    const inputWrap = document.createElement('div');
    inputWrap.style.display = 'flex';
    inputWrap.style.gap = '6px';
    inputWrap.style.marginBottom = '8px';

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.value = this.options.initialPath || '';
    this.input.placeholder = '输入筛选文件夹，或直接点击下方文件夹选择';
    this.input.style.flex = '1';
    this.input.style.padding = '8px';
    this.input.style.border = '1px solid var(--calendar-border)';
    this.input.style.borderRadius = '4px';
    this.input.style.backgroundColor = 'var(--calendar-bg)';
    this.input.style.color = 'var(--calendar-text)';
    inputWrap.appendChild(this.input);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = '✕';
    clearBtn.title = '清空输入';
    clearBtn.style.padding = '8px 10px';
    clearBtn.style.border = '1px solid var(--calendar-border)';
    clearBtn.style.borderRadius = '4px';
    clearBtn.style.backgroundColor = 'var(--calendar-bg)';
    clearBtn.style.color = 'var(--calendar-text)';
    clearBtn.style.cursor = 'pointer';
    clearBtn.style.flexShrink = '0';
    clearBtn.onclick = () => {
      this.input.value = '';
      this.renderList();
      this.input.focus();
    };
    inputWrap.appendChild(clearBtn);

    contentEl.appendChild(inputWrap);

    // 文件夹列表
    this.list = document.createElement('div');
    this.list.className = 'calendar-folder-list';
    this.list.style.maxHeight = '300px';
    contentEl.appendChild(this.list);

    // 输入自动筛选
    this.input.addEventListener('input', () => this.renderList());

    // 键盘导航：↑↓ 移动，Enter 确认，Esc 关闭（不关闭弹窗）
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.moveActive(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.moveActive(-1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const items = this.getVisibleItems();
        if (this.activeIndex >= 0 && items[this.activeIndex]) {
          items[this.activeIndex].click();
        } else if (this.input.value.trim()) {
          // 无高亮项时确认当前输入值
          this.choose(this.input.value.trim());
        }
      }
    });

    this.renderList();
    // 预填配置路径时：先标记默认路径的祖先为展开，渲染后仅定位一次
    if (this.options.initialPath) {
      this.markExpandedPath(this.options.initialPath);
      this.renderList();
      this.scrollToPath(this.options.initialPath);
    }
    this.input.focus();
  }

  onClose(): void {
    // 无额外清理需求
  }

  /**
   * 获取全部文件夹路径（缓存，排除根目录和隐藏目录）
   */
  private getFolderPaths(): string[] {
    if (!this.allFolderPaths) {
      // 排除根目录对象（其 path 可能是 '' 或 '/'，直接按对象排除最可靠）
      const rootPath = this.app.vault.getRoot().path;
      this.allFolderPaths = this.app.vault.getAllLoadedFiles()
        .filter(f => (f as TFolder).children !== undefined && f.path !== rootPath) // TFolder 才有 children
        .map(f => f.path)
        .filter(p => {
          if (!p || p === '/') return false;
          return !p.split('/').some(seg => seg && seg.startsWith('.'));
        });
    }
    return this.allFolderPaths;
  }

  /**
   * 构建文件夹树
   */
  private buildTree(paths: string[]): FolderNode {
    const root: FolderNode = { name: '', path: '', children: new Map() };
    paths.forEach(p => {
      const segs = p.split('/');
      let node = root;
      let cur = '';
      segs.forEach(s => {
        cur = cur ? `${cur}/${s}` : s;
        if (!node.children.has(s)) {
          node.children.set(s, { name: s, path: cur, children: new Map() });
        }
        node = node.children.get(s)!;
      });
    });
    return root;
  }

  /**
   * 渲染列表：空输入=树状懒加载（顶部含根目录选项），有输入=扁平筛选
   */
  private renderList(): void {
    const filter = this.input.value.trim();
    this.list.empty();
    this.activeIndex = -1;

    if (!filter) {
      // 根目录选项：留空表示根目录
      const rootRow = document.createElement('div');
      rootRow.className = 'calendar-folder-item';
      rootRow.dataset.path = '';
      rootRow.textContent = '/（根目录）';
      rootRow.onclick = () => this.choose('');
      this.list.appendChild(rootRow);

      const tree = this.buildTree(this.getFolderPaths());
      const renderNode = (node: FolderNode, depth: number) => {
        node.children.forEach(child => {
          this.list.appendChild(this.createFolderRow(child, depth));
          if (this.expandedPaths.has(child.path)) {
            renderNode(child, depth + 1);
          }
        });
      };
      renderNode(tree, 0);
    } else {
      const matched = this.getFolderPaths().filter(p => p.includes(filter));
      if (matched.length > 0) {
        matched.forEach(p => {
          const row = document.createElement('div');
          row.className = 'calendar-folder-item';
          row.dataset.path = p;
          row.textContent = p;
          row.onclick = () => this.choose(p);
          this.list.appendChild(row);
        });
      } else {
        const empty = document.createElement('div');
        empty.className = 'calendar-folder-empty';
        empty.textContent = '无匹配文件夹';
        this.list.appendChild(empty);
      }
    }
  }

  /**
   * 树节点行（带展开箭头，箭头热区放大便于点击）
   */
  private createFolderRow(child: FolderNode, depth: number): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'calendar-folder-item';
    row.dataset.path = child.path;
    row.style.paddingLeft = `${depth * 16 + 2}px`;

    const arrow = document.createElement('span');
    arrow.className = 'calendar-folder-arrow';
    if (child.children.size > 0) {
      arrow.textContent = this.expandedPaths.has(child.path) ? '▾' : '▸';
      arrow.title = this.expandedPaths.has(child.path) ? '收起' : '展开';
      arrow.onclick = (e) => {
        e.stopPropagation();
        if (this.expandedPaths.has(child.path)) {
          this.expandedPaths.delete(child.path);
        } else {
          this.expandedPaths.add(child.path);
        }
        this.renderList();
        // 展开/收起后确保该节点仍在可视区域内
        const rowEl = this.list.querySelector(`[data-path="${child.path}"]`);
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

    row.onclick = () => this.choose(child.path);

    return row;
  }

  /**
   * 选择文件夹：回调后关闭弹窗
   */
  private choose(path: string): void {
    this.options.onChoose(path);
    this.close();
  }

  /**
   * 获取当前可见的列表项
   */
  private getVisibleItems(): HTMLElement[] {
    return Array.from(this.list.querySelectorAll<HTMLElement>('.calendar-folder-item'));
  }

  /**
   * 键盘上下移动高亮
   */
  private moveActive(delta: number): void {
    const items = this.getVisibleItems();
    if (items.length === 0) return;
    this.activeIndex = (this.activeIndex + delta + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle('calendar-folder-item-active', i === this.activeIndex));
    items[this.activeIndex].scrollIntoView({ block: 'nearest' });
  }

  /**
   * 标记路径及其所有祖先为展开状态（需在 renderList 前调用）
   */
  private markExpandedPath(path: string): void {
    const segs = path.split('/').filter(Boolean);
    let cur = '';
    segs.forEach(s => {
      cur = cur ? `${cur}/${s}` : s;
      this.expandedPaths.add(cur);
    });
  }

  /**
   * 定位并高亮指定路径（列表渲染后调用）
   */
  private scrollToPath(path: string): void {
    const target = this.list.querySelector(`[data-path="${path}"]`);
    if (target) {
      target.classList.add('calendar-folder-item-selected');
      target.scrollIntoView({ block: 'center' });
    }
  }
}
