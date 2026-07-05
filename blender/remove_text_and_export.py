# -*- coding: utf-8 -*-
"""
从已有的 dunhuang_museum.blend 中删除洞窟编号文字标签，然后导出 glb
用法: blender --background dunhuang_museum.blend --python remove_text_and_export.py
"""
import bpy
import os

# glb 输出路径
OUTPUT_DIR = r"d:\sd-webui-aki\sd-webui-aki-v4.2\dunhuang-3dshow 2 国奖\public\models"
os.makedirs(OUTPUT_DIR, exist_ok=True)
GLB_PATH = os.path.join(OUTPUT_DIR, "dunhuang_museum_v2.glb")

print("=" * 60)
print("删除洞窟编号文字标签并重新导出 glb")
print("=" * 60)

# 需要删除的对象名称模式
TEXT_PATTERNS = [
    "标签板_", "标签框上_", "标签框下_", "标签框左_", "标签框右_", "标签文字_",
    "立牌文字_",
    "285", "45", "217", "17", "3窟"
]

# 洞窟编号标签对象名称（精确匹配）
LABEL_OBJECT_NAMES = []
for cave in ["285", "45", "217", "17", "3"]:
    LABEL_OBJECT_NAMES.extend([
        "标签板_{}".format(cave),
        "标签框上_{}".format(cave),
        "标签框下_{}".format(cave),
        "标签框左_{}".format(cave),
        "标签框右_{}".format(cave),
        "标签文字_{}".format(cave),
        "立牌文字_{}".format(cave),
    ])

# 遍历所有对象，删除匹配的文字标签
removed_count = 0
for obj in bpy.data.objects:
    if obj.name in LABEL_OBJECT_NAMES:
        print("  删除: {}".format(obj.name))
        bpy.data.objects.remove(obj, do_unlink=True)
        removed_count += 1
        continue

    # 对于名称包含洞窟编号组合的对象（如"西魏285窟"、"盛唐45窟"等）
    # 这些是3D文字转mesh后的对象，名称可能不同
    name = obj.name
    if any(pattern in name for pattern in ["西魏285", "西魏 285", "盛唐45", "盛唐 45", 
                                            "盛唐217", "盛唐 217", "晚唐17", "晚唐 17",
                                            "元代3", "元代 3"]):
        print("  删除文字对象: {}".format(name))
        bpy.data.objects.remove(obj, do_unlink=True)
        removed_count += 1

print("\n共删除 {} 个文字标签对象".format(removed_count))

# 清理未使用的材质和数据块
bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

# 保存修改后的 .blend 文件
BLEND_PATH = r"d:\sd-webui-aki\sd-webui-aki-v4.2\dunhuang-3dshow 2 国奖\blender\dunhuang_museum.blend"
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
print("已保存 .blend 文件: {}".format(BLEND_PATH))

# 移除所有对象的细分曲面修改器
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        to_remove = [mod for mod in obj.modifiers if mod.type == 'SUBSURF']
        for mod in to_remove:
            obj.modifiers.remove(mod)
            print("移除细分修改器: {}".format(obj.name))

# 导出 glb
bpy.ops.export_scene.gltf(
    filepath=GLB_PATH,
    export_format='GLB',
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
    export_cameras=True,
    export_lights=True,
    export_apply=True,
    export_yup=True,
)

print("\nglb 导出完成: {}".format(GLB_PATH))
print("文件大小: {:.2f} MB".format(os.path.getsize(GLB_PATH) / (1024 * 1024)))
print("=" * 60)
