# -*- coding: utf-8 -*-
"""
列出 dunhuang_museum.blend 中所有对象名称
用法: blender --background dunhuang_museum.blend --python list_objects.py
"""
import bpy

print("=" * 60)
print("列出所有对象名称")
print("=" * 60)

for obj in bpy.data.objects:
    if obj.type == 'MESH':
        print("MESH: {}".format(obj.name))

print("=" * 60)
print("搜索包含'标签'、'文字'、'窟'的对象:")
print("=" * 60)
for obj in bpy.data.objects:
    name = obj.name
    if any(kw in name for kw in ['标签', '文字', '窟', '285', '45', '217', '17', '3窟', '西魏', '盛唐', '晚唐', '元代']):
        print("{} (type={})".format(name, obj.type))
