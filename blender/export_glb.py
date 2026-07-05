# -*- coding: utf-8 -*-
"""
从 dunhuang_museum.blend 导出 glb 模型与贴图资源
用法: blender --background dunhuang_museum.blend --python export_glb.py
"""
import bpy
import os

# 输出目录
OUTPUT_DIR = r"d:\sd-webui-aki\sd-webui-aki-v4.2\dunhuang-3dshow 2 国奖\public\models"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# glb 输出路径
GLB_PATH = os.path.join(OUTPUT_DIR, "dunhuang_museum_v2.glb")

print("=" * 60)
print("Blender glb 导出脚本")
print("=" * 60)

# 确保所有对象都可见
bpy.ops.object.select_all(action='SELECT')

# 移除所有对象的细分曲面修改器，大幅减少多边形数量
# 雕塑基础几何已足够立体，无需细分曲面
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        to_remove = [mod for mod in obj.modifiers if mod.type == 'SUBSURF']
        for mod in to_remove:
            obj.modifiers.remove(mod)
            print("移除细分修改器: {}".format(obj.name))

# 导出 glb 格式（Blender 5.0 API）
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

print("glb 导出完成: {}".format(GLB_PATH))
print("文件大小: {:.2f} MB".format(os.path.getsize(GLB_PATH) / (1024 * 1024)))
print("=" * 60)
