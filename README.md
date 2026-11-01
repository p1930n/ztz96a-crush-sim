# ZTZ-96A 碾压模拟

用 three.js 做的交互页面：一辆 ZTZ-96A 主战坦克碾压报废车辆，可以切换车型、压法和机位，并回放。只表现车辆和机械的破坏。

## 构建

需要 Python 3，不需要安装依赖。

```bash
python -I build.py
```

会在项目根目录生成 `ZTZ-96A 主战坦克（实车外形）.html`。其他用法：

```bash
python -I build.py test
```

额外生成 `test.html`，带步进时钟和调试接口。

```bash
python -I build.py lan <目录>
```

生成局域网版，不依赖外部网络。该目录里还需要放 r147 的 `three.min.js` 和 `OrbitControls.js`。

## 运行

页面需要通过 HTTP 打开，才能读取 `assets/` 里的贴图。双击 HTML 打开时会退回代码生成的材质。

```bash
python -m http.server 8080 --bind 0.0.0.0
```

其他设备访问前，可能需要运行 `open-lan-8080.bat` 放行防火墙端口。

## 目录

- `src/js/`：一个脚本按主题拆成的多个文件，共享同一作用域，按文件名顺序拼接。
- `src/style.css`、`src/page.html`：样式和页面骨架。
- `assets/`：贴图和天空，来自 [Poly Haven](https://polyhaven.com)，CC0 授权，详见 `assets/README.txt`。

## 车身物理

车身是一套金属壳和骨架结构（约 550 个节点、2800 根成员），用 XPBD 求解：

- 每根成员有拉伸和压缩的力上限，到达上限后塑性变形。薄板受压会屈曲，留下折痕。
- 门、引擎盖、后备箱、保险杠靠铰链、门锁和卡扣连接，这些连接会断。
- 发动机、座椅骨架、轮毂是独立的实体。节点带厚度半径，金属折叠后会叠起来。
- 高精度网格绑定在结构上，结构顶面再写回旧的高度网格，供坦克、泥块落点和界面读取。

代码在 `src/js/10b-shell-build.js`、`src/js/11-shell.js`、`src/js/11b-shell-car.js`。

求解器的物理检查不需要浏览器：

```bash
node tests/shell.test.js
```

页面地址后加 `?field` 可以切回旧的高度场车身。

## 其他目标

“车型”里还有毛绒玩具和测试假人，代码在 `src/js/11c-props.js`，用同一个求解器。假人只表现机械断裂，各部位的强度值是公开耐受数据的近似值，并非都经过核对。
