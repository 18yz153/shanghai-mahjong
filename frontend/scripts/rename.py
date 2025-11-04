import os
import re

# SVG 文件夹路径
folder = 'svg'

# 假设你现在的 SVG 文件名是类似 "1m.svg", "2p.svg", "3s.svg"
# 我们重命名成你的 tile 命名规则: B1-B9, C1-C9, D1-D9, WE, WS, WW, WN, DR, DG, DW, F1-F4

# 定义映射
suit_map = {'m': 'B', 'p': 'C', 's': 'D'}

for filename in os.listdir(folder):
    if not filename.endswith('.svg'):
        continue

    name, ext = os.path.splitext(filename)
    new_name = ''

    # 条/万/筒
    match = re.match(r'^(\d)([mps])$', name)
    if match:
        num, suit = match.groups()
        new_name = f"{suit_map[suit]}{num}.svg"
    # 风牌
    elif name in ['E', 'S', 'W', 'N']:
        new_name = f"W{name}.svg"
    # 箭牌
    elif name in ['R', 'G', 'W']:
        new_name = f"D{name}.svg"
    # 花牌 F1-F4
    elif re.match(r'^F[1-4]$', name):
        new_name = f"{name}.svg"
    else:
        print(f"未处理文件: {filename}")
        continue

    old_path = os.path.join(folder, filename)
    new_path = os.path.join(folder, new_name)
    os.rename(old_path, new_path)
    print(f"重命名: {filename} -> {new_name}")

print("重命名完成！")
