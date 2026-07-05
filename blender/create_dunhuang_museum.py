# -*- coding: utf-8 -*-
"""
Blender Python 脚本：按照专业博物馆标准创建敦煌 3D 展馆
包含四大功能区、5间复刻洞窟、壁画布置、彩塑人像、灯光系统
用法: blender --background --python create_dunhuang_museum.py
"""
import bpy
import os
import math
import random
import bmesh
from mathutils import Vector

# ============================================================
# 配置
# ============================================================
IMAGE_DIR = r"d:\sd-webui-aki\sd-webui-aki-v4.2\kohya_ss\dunhuang_gallery_v3"
OUTPUT_BLEND = r"d:\sd-webui-aki\sd-webui-aki-v4.2\dunhuang-3dshow 2 国奖\blender\dunhuang_museum.blend"

# 展馆总尺寸（米）
MUSEUM_LENGTH = 72.0   # X 轴总长度（延长以容纳3窟完整范围和数字区）
MUSEUM_WIDTH = 16.0    # Y 轴总宽度
MUSEUM_HEIGHT = 5.5    # Z 轴总高度
WALL_THICKNESS = 0.25  # 墙壁厚度

# 四大功能区划分（X 轴方向）
# 3窟 x_start=36，范围36-44，洞窟区需延伸至44以避免陈列区隔墙遮挡3窟雕塑
ZONE_ENTRANCE_END = 8.0       # 序厅结束
ZONE_CAVES_END = 44.0         # 洞窟区结束（3窟后墙位置）
ZONE_DISPLAY_END = 56.0       # 陈列区结束
# 数字区: 56.0 ~ 68.0

# 洞窟参数
CAVE_COUNT = 5
CAVE_WIDTH = 6.0     # 每间洞窟宽度（Y 轴）
CAVE_DEPTH = 8.0     # 每间洞窟深度（X 轴）
CAVE_HEIGHT = 4.0    # 洞窟高度
CAVE_WALL_GAP = 1.0  # 洞窟之间间隔

# 彩塑基座高度（厘米转米）
BASE_BUDDHA = 0.60    # 佛像基座
BASE_BODHISATTVA = 0.40  # 菩萨弟子基座
BASE_GUARDIAN = 0.25  # 天王力士基座

# 图片列表
GALLERY_IMAGES = {
    "caisson": "01_caisson_ceiling.png",
    "thousand_buddhas": "02_thousand_buddhas.png",
    "flying_apsara": "03_flying_apsara.png",
    "celestial_musicians": "04_celestial_musicians.png",
    "sutra": "05_sutra_illustration.png",
    "donors": "06_donor_portraits.png",
    "daily_life": "07_daily_life.png",
    "guardian_bodhisattva": "08_guardian_bodhisattva.png",
    "main_buddha": "09_main_buddha.png",
    "kasyapa": "10_disciple_kasyapa.png",
    "ananda": "11_disciple_ananda.png",
    "attendant_bodhisattva": "12_attendant_bodhisattva.png",
    "heavenly_king": "13_heavenly_king.png",
    "vajra_warrior": "14_vajra_warrior.png",
    "northern_buddha": "15_northern_buddha.png",
    "sui_statue": "16_sui_dynasty_statue.png",
    "tang_bodhisattva": "17_tang_bodhisattva.png",
    "late_tang_monk": "18_late_tang_monk.png",
    "cave_interior": "19_cave_interior.png",
    "cliff_texture": "20_cliff_texture.png",
}

# 285窟专属图片映射（西魏风格壁画：伏羲女娲、瘦骨清像、西魏飞天、西魏供养人）
# 使用现有图片中与西魏风格最匹配的组合，确保与其他洞窟不重复
CAVE_285_IMAGES = {
    "flying_apsara": "03_flying_apsara.png",           # 飞天（伏羲女娲神话题材）
    "celestial_musicians": "04_celestial_musicians.png", # 天宫伎乐（瘦骨清像风格）
    "sutra": "05_sutra_illustration.png",                # 经变画（西魏飞天）
    "donors": "06_donor_portraits.png",                 # 供养人（西魏供养人）
    "caisson": "01_caisson_ceiling.png",                 # 藻井（西魏藻井）
}

# 45窟专属图片映射（盛唐风格壁画：七身彩塑、经变画、盛唐飞天、盛唐供养人）
# 使用与佛像彩塑相关的图片，确保与其他洞窟不重复
CAVE_45_IMAGES = {
    "flying_apsara": "09_main_buddha.png",              # 主佛（七身彩塑主佛）
    "celestial_musicians": "10_disciple_kasyapa.png",   # 迦叶（老弟子）
    "sutra": "11_disciple_ananda.png",                  # 阿难（少弟子）
    "donors": "12_attendant_bodhisattva.png",           # 胁侍菩萨
    "daily_life": "02_thousand_buddhas.png",            # 千佛图（盛唐背景）
    "caisson": "13_heavenly_king.png",                  # 天王（盛唐藻井替代）
}

# 217窟专属图片映射（盛唐风格壁画：观无量寿经变、丰腴菩萨、盛唐伎乐、盛唐建筑）
# 使用与217窟经变画主题相关的图片，确保与其他洞窟不重复
CAVE_217_IMAGES = {
    "flying_apsara": "14_vajra_warrior.png",            # 力士（经变画护法）
    "celestial_musicians": "15_northern_buddha.png",    # 北方佛像（丰腴菩萨风格）
    "sutra": "16_sui_dynasty_statue.png",               # 隋代造像（盛唐伎乐）
    "donors": "07_daily_life.png",                     # 市井生活（盛唐建筑）
    "caisson": "08_guardian_bodhisattva.png",           # 护法菩萨（盛唐藻井替代）
}

# 17窟专属图片映射（晚唐风格壁画：藏经洞绢画、晚唐供养人、文书经卷、晚唐壁画）
# 使用与藏经洞主题相关的图片，确保与其他洞窟不重复
CAVE_17_IMAGES = {
    "flying_apsara": "17_tang_bodhisattva.png",         # 唐代菩萨（藏经洞绢画）
    "celestial_musicians": "18_late_tang_monk.png",     # 晚唐僧人（晚唐供养人）
    "sutra": "19_cave_interior.png",                    # 洞窟内部（文书经卷）
    "donors": "20_cliff_texture.png",                   # 崖壁纹理（晚唐壁画）
    "daily_life": "19_cave_interior.png",               # 洞窟内部（藏经绢画）
    "caisson": "20_cliff_texture.png",                  # 崖壁纹理（晚唐藻井替代）
}

# 3窟专属图片映射（元代密宗风格壁画：千手观音、密宗护法、密宗金刚力士、密宗千佛）
# 选用与密宗主题最相关的图片组合，确保与其他洞窟图片组合不重复
CAVE_3_IMAGES = {
    "flying_apsara": "09_main_buddha.png",              # 主佛（密宗主尊千手观音）
    "celestial_musicians": "12_attendant_bodhisattva.png", # 胁侍菩萨（密宗胁侍）
    "sutra": "13_heavenly_king.png",                   # 天王（密宗护法天王经变画）
    "donors": "14_vajra_warrior.png",                  # 力士（密宗金刚力士供养）
    "thousand_buddhas": "02_thousand_buddhas.png",     # 千佛图（密宗千佛）
    "caisson": "08_guardian_bodhisattva.png",           # 护法菩萨（密宗藻井团花）
}

# 走廊/序厅专属图片映射（使用现有图片，不与洞窟主要展品重复）
CORRIDOR_IMAGES = {
    "flying_apsara": "03_flying_apsara.png",      # 序厅飞天暗纹
    "thousand_buddhas": "02_thousand_buddhas.png", # 走廊千佛暗纹
}

# 洞窟信息
CAVES = [
    {"name": "285", "dynasty": "西魏", "x_start": 8.0},
    {"name": "45", "dynasty": "盛唐", "x_start": 15.0},
    {"name": "217", "dynasty": "盛唐", "x_start": 22.0},
    {"name": "17", "dynasty": "晚唐", "x_start": 29.0},
    {"name": "3", "dynasty": "元代", "x_start": 36.0},
]

# ============================================================
# 敦煌传统矿物色彩体系
# ============================================================
COLOR_SHIQING = (0.290, 0.486, 0.549)    # 石青 #4A7C8C
COLOR_SHILV = (0.357, 0.549, 0.416)      # 石绿 #5B8C6A
COLOR_ZHUSHA = (0.769, 0.271, 0.212)     # 朱砂 #C44536
COLOR_TUHUANG = (0.769, 0.651, 0.408)    # 土黄 #C4A668
COLOR_ZHESHI = (0.545, 0.353, 0.235)     # 赭石 #8B5A3C


# ============================================================
# 工具函数
# ============================================================
def clear_scene():
    """清空场景"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)
    for block in bpy.data.images:
        bpy.data.images.remove(block)
    for block in bpy.data.lights:
        bpy.data.lights.remove(block)
    for block in bpy.data.cameras:
        bpy.data.cameras.remove(block)
    print("场景已清空")


def create_material(name, base_color, roughness=0.85, metallic=0.0):
    """创建标准材质（哑光低饱和色系）"""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    return mat


def create_image_material(name, image_path, roughness=0.6):
    """创建图片纹理材质"""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    for node in nodes:
        nodes.remove(node)

    tex_node = nodes.new(type='ShaderNodeTexImage')
    if os.path.exists(image_path):
        tex_node.image = bpy.data.images.load(image_path)
    else:
        print("  警告: 图片不存在: {}".format(image_path))

    bsdf_node = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf_node.inputs["Roughness"].default_value = roughness
    output_node = nodes.new(type='ShaderNodeOutputMaterial')
    links.new(tex_node.outputs["Color"], bsdf_node.inputs["Base Color"])
    links.new(bsdf_node.outputs["BSDF"], output_node.inputs["Surface"])
    return mat


def add_box(name, location, scale, material=None, rotation=(0, 0, 0)):
    """创建立方体并应用变换"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if material:
        obj.data.materials.append(material)
    return obj


def add_plane(name, location, scale, material=None, rotation=(0, 0, 0)):
    """创建平面并应用变换"""
    bpy.ops.mesh.primitive_plane_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if material:
        obj.data.materials.append(material)
    return obj


def create_text_label(name, text, location, size=0.3, extrude=0.03,
                      material=None, rotation=(0, 0, 0)):
    """创建3D文字标签（自动加载中文字体并转换为网格）"""
    font = None
    for font_path in [r"C:\Windows\Fonts\simhei.ttf",
                      r"C:\Windows\Fonts\msyh.ttc",
                      r"C:\Windows\Fonts\simsun.ttc"]:
        if os.path.exists(font_path):
            try:
                font = bpy.data.fonts.load(font_path)
                break
            except Exception:
                continue

    bpy.ops.object.text_add(location=location)
    text_obj = bpy.context.active_object
    text_obj.name = name
    text_obj.data.body = text
    text_obj.data.size = size
    text_obj.data.extrude = extrude
    text_obj.rotation_euler = rotation
    if font:
        text_obj.data.font = font

    bpy.ops.object.convert(target='MESH')
    if material:
        text_obj.data.materials.append(material)
    return text_obj


def create_bumpy_wall(name, location, scale, material, rotation=(0, 0, 0),
                     bumpiness=0.2, subdivisions=6):
    """创建凹凸不平的崖壁面（用bmesh细分+位移修改器模拟戈壁砂岩）"""
    bpy.ops.mesh.primitive_plane_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=subdivisions,
                              use_grid_fill=True)
    bm.to_mesh(obj.data)
    bm.free()

    tex = bpy.data.textures.new(name=name + "_tex", type='STUCCI')
    tex.noise_scale = 0.3
    mod = obj.modifiers.new(name="Displace", type='DISPLACE')
    mod.texture = tex
    mod.strength = bumpiness
    mod.mid_level = 0.5

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)

    if material:
        obj.data.materials.append(material)
    return obj


def create_faint_mural_material(name, image_path, base_color=(0.3, 0.25, 0.18),
                                intensity=0.35, roughness=0.92):
    """创建淡壁画肌理材质（图片纹理叠加在矿物底色上）"""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    for node in nodes:
        nodes.remove(node)

    tex_node = nodes.new(type='ShaderNodeTexImage')
    if os.path.exists(image_path):
        tex_node.image = bpy.data.images.load(image_path)
    else:
        print("  警告: 图片不存在: {}".format(image_path))

    mix_node = nodes.new(type='ShaderNodeMixRGB')
    mix_node.inputs["Fac"].default_value = intensity
    mix_node.inputs["Color1"].default_value = (*base_color, 1.0)
    links.new(tex_node.outputs["Color"], mix_node.inputs["Color2"])

    bsdf_node = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf_node.inputs["Roughness"].default_value = roughness
    output_node = nodes.new(type='ShaderNodeOutputMaterial')
    links.new(mix_node.outputs["Color"], bsdf_node.inputs["Base Color"])
    links.new(bsdf_node.outputs["BSDF"], output_node.inputs["Surface"])
    return mat


def create_procedural_mural(name, base_color, pattern_type, dynasty):
    """
    创建程序化壁画纹理材质（使用 Blender 程序化纹理节点）
    根据图案类型和朝代生成不同的壁画效果，确保每个洞窟视觉差异化
    参数:
        name: 材质名称
        base_color: 基础矿物色 (r, g, b)
        pattern_type: 图案类型 ('flying', 'sutra', 'donor', 'caisson',
                      'daily_life', 'thousand_buddha')
        dynasty: 朝代 ('西魏', '盛唐', '晚唐', '元代')
    返回: 材质对象
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    for node in nodes:
        nodes.remove(node)

    # 输出节点和 BSDF 节点
    output_node = nodes.new(type='ShaderNodeOutputMaterial')
    bsdf_node = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf_node.inputs["Roughness"].default_value = 0.92

    # 根据朝代设置纹理参数（不同朝代使用不同的噪声尺度，确保视觉差异化）
    dynasty_params = {
        "西魏": {"noise_scale": 8.0, "musgrave_scale": 4.0,
                 "voronoi_scale": 6.0, "detail": 4.0, "distortion": 0.5},
        "盛唐": {"noise_scale": 12.0, "musgrave_scale": 6.0,
                 "voronoi_scale": 8.0, "detail": 6.0, "distortion": 1.0},
        "晚唐": {"noise_scale": 10.0, "musgrave_scale": 5.0,
                 "voronoi_scale": 7.0, "detail": 5.0, "distortion": 0.8},
        "元代": {"noise_scale": 15.0, "musgrave_scale": 7.0,
                 "voronoi_scale": 10.0, "detail": 8.0, "distortion": 1.5},
    }
    params = dynasty_params.get(dynasty, dynasty_params["盛唐"])

    # 纹理坐标和映射节点
    tex_coord = nodes.new(type='ShaderNodeTexCoord')
    mapping = nodes.new(type='ShaderNodeMapping')
    mapping.inputs["Scale"].default_value = (
        params["noise_scale"], params["noise_scale"], 1.0)
    links.new(tex_coord.outputs["Generated"], mapping.inputs["Vector"])

    # 根据图案类型生成不同纹理
    if pattern_type == 'flying':
        # 飞天图案：Noise + Wave 生成飘逸流动线条
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.inputs["Scale"].default_value = params["noise_scale"]
        noise.inputs["Detail"].default_value = params["detail"]
        noise.inputs["Distortion"].default_value = params["distortion"]
        links.new(mapping.outputs["Vector"], noise.inputs["Vector"])

        wave = nodes.new(type='ShaderNodeTexWave')
        wave.inputs["Scale"].default_value = params["noise_scale"] * 0.5
        links.new(mapping.outputs["Vector"], wave.inputs["Vector"])

        mix = nodes.new(type='ShaderNodeMixRGB')
        mix.inputs["Fac"].default_value = 0.5
        mix.inputs["Color1"].default_value = (*base_color, 1.0)
        links.new(noise.outputs["Color"], mix.inputs["Color2"])
        links.new(wave.outputs["Color"], mix.inputs["Fac"])
        links.new(mix.outputs["Color"], bsdf_node.inputs["Base Color"])

    elif pattern_type == 'sutra':
        # 经变画：Musgrave 生成层次丰富的画面感
        musgrave = nodes.new(type='ShaderNodeTexMusgrave')
        musgrave.inputs["Scale"].default_value = params["musgrave_scale"]
        musgrave.inputs["Detail"].default_value = params["detail"]
        links.new(mapping.outputs["Vector"], musgrave.inputs["Vector"])

        color_ramp = nodes.new(type='ShaderNodeValToRGB')
        links.new(musgrave.outputs["Fac"], color_ramp.inputs["Fac"])
        color_ramp.color_ramp.elements[0].color = (*base_color, 1.0)
        darker = (base_color[0] * 0.6, base_color[1] * 0.6,
                  base_color[2] * 0.6, 1.0)
        color_ramp.color_ramp.elements[1].color = darker
        links.new(color_ramp.outputs["Color"], bsdf_node.inputs["Base Color"])

    elif pattern_type == 'donor':
        # 供养人纹理：Voronoi 生成人物轮廓格子图案
        voronoi = nodes.new(type='ShaderNodeTexVoronoi')
        voronoi.inputs["Scale"].default_value = params["voronoi_scale"]
        links.new(mapping.outputs["Vector"], voronoi.inputs["Vector"])

        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.inputs["Scale"].default_value = params["noise_scale"] * 2.0
        noise.inputs["Detail"].default_value = params["detail"]
        links.new(mapping.outputs["Vector"], noise.inputs["Vector"])

        mix = nodes.new(type='ShaderNodeMixRGB')
        mix.inputs["Fac"].default_value = 0.4
        mix.inputs["Color1"].default_value = (*base_color, 1.0)
        links.new(voronoi.outputs["Color"], mix.inputs["Color2"])
        links.new(noise.outputs["Color"], mix.inputs["Fac"])
        links.new(mix.outputs["Color"], bsdf_node.inputs["Base Color"])

    elif pattern_type == 'caisson':
        # 藻井团花：Voronoi + Wave 生成对称团花纹样
        voronoi = nodes.new(type='ShaderNodeTexVoronoi')
        voronoi.inputs["Scale"].default_value = params["voronoi_scale"] * 1.5
        links.new(mapping.outputs["Vector"], voronoi.inputs["Vector"])

        wave = nodes.new(type='ShaderNodeTexWave')
        wave.inputs["Scale"].default_value = params["noise_scale"]
        links.new(mapping.outputs["Vector"], wave.inputs["Vector"])

        mix = nodes.new(type='ShaderNodeMixRGB')
        mix.inputs["Fac"].default_value = 0.6
        mix.inputs["Color1"].default_value = (*base_color, 1.0)
        links.new(voronoi.outputs["Color"], mix.inputs["Color2"])
        links.new(wave.outputs["Color"], mix.inputs["Fac"])
        links.new(mix.outputs["Color"], bsdf_node.inputs["Base Color"])

    elif pattern_type == 'daily_life':
        # 生活场景：Noise + Musgrave 生成市井场景肌理
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.inputs["Scale"].default_value = params["noise_scale"] * 0.8
        noise.inputs["Detail"].default_value = params["detail"]
        links.new(mapping.outputs["Vector"], noise.inputs["Vector"])

        musgrave = nodes.new(type='ShaderNodeTexMusgrave')
        musgrave.inputs["Scale"].default_value = params["musgrave_scale"] * 0.7
        musgrave.inputs["Detail"].default_value = params["detail"]
        links.new(mapping.outputs["Vector"], musgrave.inputs["Vector"])

        mix = nodes.new(type='ShaderNodeMixRGB')
        mix.inputs["Fac"].default_value = 0.5
        mix.inputs["Color1"].default_value = (*base_color, 1.0)
        links.new(noise.outputs["Color"], mix.inputs["Color2"])
        links.new(musgrave.outputs["Fac"], mix.inputs["Fac"])
        links.new(mix.outputs["Color"], bsdf_node.inputs["Base Color"])

    elif pattern_type == 'thousand_buddha':
        # 千佛图：Voronoi 生成密集格子图案模拟千佛阵列
        voronoi = nodes.new(type='ShaderNodeTexVoronoi')
        voronoi.inputs["Scale"].default_value = params["voronoi_scale"] * 2.0
        links.new(mapping.outputs["Vector"], voronoi.inputs["Vector"])

        color_ramp = nodes.new(type='ShaderNodeValToRGB')
        links.new(voronoi.outputs["Distance"], color_ramp.inputs["Fac"])
        color_ramp.color_ramp.elements[0].color = (
            base_color[0] * 0.5, base_color[1] * 0.5,
            base_color[2] * 0.5, 1.0)
        color_ramp.color_ramp.elements[1].color = (*base_color, 1.0)
        links.new(color_ramp.outputs["Color"], bsdf_node.inputs["Base Color"])

    else:
        # 默认：简单 Noise 纹理
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.inputs["Scale"].default_value = params["noise_scale"]
        links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
        bsdf_node.inputs["Base Color"].default_value = (*base_color, 1.0)

    links.new(bsdf_node.outputs["BSDF"], output_node.inputs["Surface"])
    return mat


def create_cave_mural_material(name, image_path, base_color, pattern_type, dynasty):
    """
    创建洞窟壁画材质：优先使用专属图片，图片不存在则使用程序化纹理
    参数:
        name: 材质名称
        image_path: 专属图片路径
        base_color: 基础矿物色 (r, g, b)
        pattern_type: 图案类型（用于程序化纹理）
        dynasty: 朝代（用于程序化纹理）
    返回: 材质对象
    """
    if os.path.exists(image_path):
        return create_image_material(name, image_path)
    else:
        print("  专属图片不存在，使用程序化纹理: {}".format(image_path))
        return create_procedural_mural(name, base_color, pattern_type, dynasty)


def create_emissive_material(name, base_color, strength=2.0, roughness=0.5):
    """创建发光材质（用于灯龛等）"""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    for node in nodes:
        nodes.remove(node)

    bsdf_node = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf_node.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf_node.inputs["Roughness"].default_value = roughness
    if "Emission Color" in bsdf_node.inputs:
        bsdf_node.inputs["Emission Color"].default_value = (*base_color, 1.0)
        bsdf_node.inputs["Emission Strength"].default_value = strength
    elif "Emission" in bsdf_node.inputs:
        bsdf_node.inputs["Emission"].default_value = (*base_color, 1.0)
        if "Emission Strength" in bsdf_node.inputs:
            bsdf_node.inputs["Emission Strength"].default_value = strength

    output_node = nodes.new(type='ShaderNodeOutputMaterial')
    links.new(bsdf_node.outputs["BSDF"], output_node.inputs["Surface"])
    return mat


# ============================================================
# 一、展馆整体结构
# ============================================================
def create_museum_structure():
    """创建展馆整体结构：地板、天花板、外墙"""
    print("\n--- 创建展馆整体结构 ---")

    # 地板材质：固定哑光仿古砂岩色（低饱和度赭石土棕）
    floor_mat = create_material("地板_哑光仿古砂岩", (0.22, 0.18, 0.14), roughness=1.0)

    # 天花板材质：哑光砂岩色
    ceiling_mat = create_material("天花板_砂岩色", (0.45, 0.38, 0.28), roughness=0.9)

    # 外墙材质：哑光砂岩土黄色
    wall_mat = create_material("外墙_砂岩土黄", (0.50, 0.40, 0.26), roughness=0.88)

    # 地板
    add_box("地板", (MUSEUM_LENGTH / 2, 0, -WALL_THICKNESS / 2),
            (MUSEUM_LENGTH, MUSEUM_WIDTH, WALL_THICKNESS), floor_mat)

    # 天花板
    add_box("天花板", (MUSEUM_LENGTH / 2, 0, MUSEUM_HEIGHT + WALL_THICKNESS / 2),
            (MUSEUM_LENGTH, MUSEUM_WIDTH, WALL_THICKNESS), ceiling_mat)

    # 前墙（Y = -MUSEUM_WIDTH/2）
    add_box("前墙", (MUSEUM_LENGTH / 2, -MUSEUM_WIDTH / 2, MUSEUM_HEIGHT / 2),
            (MUSEUM_LENGTH, WALL_THICKNESS, MUSEUM_HEIGHT), wall_mat)

    # 后墙（Y = MUSEUM_WIDTH/2）
    add_box("后墙", (MUSEUM_LENGTH / 2, MUSEUM_WIDTH / 2, MUSEUM_HEIGHT / 2),
            (MUSEUM_LENGTH, WALL_THICKNESS, MUSEUM_HEIGHT), wall_mat)

    # 左墙（入口墙，X = 0）- 留出入口
    add_box("入口墙_上", (0, 0, MUSEUM_HEIGHT * 0.75),
            (WALL_THICKNESS, MUSEUM_WIDTH, MUSEUM_HEIGHT * 0.5), wall_mat)
    add_box("入口墙_左", (0, -MUSEUM_WIDTH / 2 + 1.5, MUSEUM_HEIGHT * 0.25),
            (WALL_THICKNESS, MUSEUM_WIDTH - 3.0, MUSEUM_HEIGHT * 0.5), wall_mat)
    add_box("入口墙_右", (0, MUSEUM_WIDTH / 2 - 1.5, MUSEUM_HEIGHT * 0.25),
            (WALL_THICKNESS, MUSEUM_WIDTH - 3.0, MUSEUM_HEIGHT * 0.5), wall_mat)

    # 右墙（出口墙，X = MUSEUM_LENGTH）
    add_box("出口墙", (MUSEUM_LENGTH, 0, MUSEUM_HEIGHT / 2),
            (WALL_THICKNESS, MUSEUM_WIDTH, MUSEUM_HEIGHT), wall_mat)

    print("展馆整体结构完成")


# ============================================================
# 二、序厅
# ============================================================
def create_entrance_hall():
    """创建序厅：入口过渡空间"""
    print("\n--- 创建序厅 ---")

    # 崖壁肌理材质（序厅墙面）
    cliff_path = os.path.join(IMAGE_DIR, GALLERY_IMAGES["cliff_texture"])
    cliff_mat = create_image_material("序厅_崖壁肌理", cliff_path, roughness=0.95)

    # 序厅隔墙（分隔序厅和洞窟区）
    partition_mat = create_material("隔墙_砂岩色", (0.48, 0.38, 0.25), roughness=0.88)

    # 序厅与洞窟区之间的隔墙（X = ZONE_ENTRANCE_END）
    # 留出通道
    add_box("序厅隔墙_上", (ZONE_ENTRANCE_END, 0, MUSEUM_HEIGHT * 0.75),
            (WALL_THICKNESS, MUSEUM_WIDTH, MUSEUM_HEIGHT * 0.5), partition_mat)
    add_box("序厅隔墙_左", (ZONE_ENTRANCE_END, -MUSEUM_WIDTH / 2 + 2.0, MUSEUM_HEIGHT * 0.25),
            (WALL_THICKNESS, MUSEUM_WIDTH - 4.0, MUSEUM_HEIGHT * 0.5), partition_mat)
    add_box("序厅隔墙_右", (ZONE_ENTRANCE_END, MUSEUM_WIDTH / 2 - 2.0, MUSEUM_HEIGHT * 0.25),
            (WALL_THICKNESS, MUSEUM_WIDTH - 4.0, MUSEUM_HEIGHT * 0.5), partition_mat)

    # 序厅墙面贴崖壁肌理图片（前墙和后墙各一块）
    mural_w = 5.0
    mural_h = 3.0
    mural_z = MUSEUM_HEIGHT * 0.5

    # 前墙崖壁肌理
    add_plane("序厅_前墙崖壁", (4.0, -MUSEUM_WIDTH / 2 + 0.15, mural_z),
              (mural_w, mural_h, 1), cliff_mat,
              rotation=(math.radians(90), 0, math.radians(180)))

    # 后墙崖壁肌理
    add_plane("序厅_后墙崖壁", (4.0, MUSEUM_WIDTH / 2 - 0.15, mural_z),
              (mural_w, mural_h, 1), cliff_mat,
              rotation=(math.radians(90), 0, 0))

    # 九层楼浮雕（简化为多层方块结构）
    pagoda_mat = create_material("九层楼_砂岩色", (0.55, 0.45, 0.30), roughness=0.85)
    pagoda_x = 2.0
    pagoda_y = MUSEUM_WIDTH / 2 - 0.3
    for i in range(9):
        layer_w = 3.0 - i * 0.25
        layer_h = 0.35
        layer_z = 0.5 + i * 0.4
        add_box("九层楼_{}".format(i + 1),
                (pagoda_x, pagoda_y, layer_z),
                (0.3, layer_w, layer_h), pagoda_mat)

    # 简化藻井装置（顶部悬挂）
    caisson_path = os.path.join(IMAGE_DIR, GALLERY_IMAGES["caisson"])
    caisson_mat = create_image_material("序厅_藻井装置", caisson_path, roughness=0.5)
    add_plane("序厅_藻井装置", (4.0, 0, MUSEUM_HEIGHT - 0.1),
              (4.0, 4.0, 1), caisson_mat,
              rotation=(0, 0, 0))

    # 时间轴展板（简化）
    timeline_mat = create_material("时间轴展板", (0.35, 0.30, 0.22), roughness=0.8)
    add_plane("时间轴展板", (6.0, -MUSEUM_WIDTH / 2 + 0.2, 1.2),
              (3.0, 0.8, 1), timeline_mat,
              rotation=(math.radians(90), 0, math.radians(180)))

    print("序厅完成")


# ============================================================
# 三、核心复刻洞窟区
# ============================================================
def create_cave(cave_info, cave_index):
    """
    创建一间复刻洞窟
    包含：覆斗藻井顶、人字披、佛龛、门洞、壁画、彩塑
    """
    cave_name = cave_info["name"]
    dynasty = cave_info["dynasty"]
    x_start = cave_info["x_start"]
    x_center = x_start + CAVE_DEPTH / 2

    print("  创建洞窟: {}窟 ({})".format(cave_name, dynasty))

    # 洞窟材质（内部墙面：风化斑驳痕迹）
    cave_wall_mat = create_material(
        "洞窟{}_墙面".format(cave_name), (0.42, 0.33, 0.22), roughness=0.92)
    cave_floor_mat = create_material(
        "洞窟{}_地面".format(cave_name), (0.30, 0.25, 0.18), roughness=0.95)

    # 洞窟范围
    y_center = 0
    y_min = -CAVE_WIDTH / 2
    y_max = CAVE_WIDTH / 2

    # 洞窟隔墙（左右两侧）
    add_box("洞窟{}_左墙".format(cave_name),
            (x_center, y_min, CAVE_HEIGHT / 2),
            (CAVE_DEPTH, WALL_THICKNESS, CAVE_HEIGHT), cave_wall_mat)
    add_box("洞窟{}_右墙".format(cave_name),
            (x_center, y_max, CAVE_HEIGHT / 2),
            (CAVE_DEPTH, WALL_THICKNESS, CAVE_HEIGHT), cave_wall_mat)

    # 后墙（佛龛墙）
    add_box("洞窟{}_后墙".format(cave_name),
            (x_start + CAVE_DEPTH - WALL_THICKNESS / 2, y_center, CAVE_HEIGHT / 2),
            (WALL_THICKNESS, CAVE_WIDTH, CAVE_HEIGHT), cave_wall_mat)

    # 前墙（门洞墙，留出门洞）
    door_width = 2.0
    door_height = 2.5
    add_box("洞窟{}_前墙_上".format(cave_name),
            (x_start + WALL_THICKNESS / 2, y_center, CAVE_HEIGHT - (CAVE_HEIGHT - door_height) / 2),
            (WALL_THICKNESS, CAVE_WIDTH, CAVE_HEIGHT - door_height), cave_wall_mat)
    add_box("洞窟{}_前墙_左".format(cave_name),
            (x_start + WALL_THICKNESS / 2, y_min + (CAVE_WIDTH - door_width) / 4, door_height / 2),
            (WALL_THICKNESS, (CAVE_WIDTH - door_width) / 2, door_height), cave_wall_mat)
    add_box("洞窟{}_前墙_右".format(cave_name),
            (x_start + WALL_THICKNESS / 2, y_max - (CAVE_WIDTH - door_width) / 4, door_height / 2),
            (WALL_THICKNESS, (CAVE_WIDTH - door_width) / 2, door_height), cave_wall_mat)

    # 洞窟地面
    add_box("洞窟{}_地面".format(cave_name),
            (x_center, y_center, -0.05),
            (CAVE_DEPTH, CAVE_WIDTH, 0.1), cave_floor_mat)

    # 覆斗藻井顶（简化为倾斜的四块板）
    caisson_path = os.path.join(IMAGE_DIR, GALLERY_IMAGES["caisson"])
    caisson_mat = create_image_material("洞窟{}_藻井".format(cave_name), caisson_path, roughness=0.5)

    # 顶部中心藻井图片
    add_plane("洞窟{}_藻井顶".format(cave_name),
              (x_center, y_center, CAVE_HEIGHT - 0.05),
              (3.0, 3.0, 1), caisson_mat)

    # 覆斗四面斜板（简化）
    slope_mat = create_material("洞窟{}_覆斗".format(cave_name), (0.40, 0.32, 0.20), roughness=0.9)
    slope_size = 1.5
    for angle_y in [0, 90, 180, 270]:
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x_center, y_center, CAVE_HEIGHT - 0.5))
        slope = bpy.context.active_object
        slope.name = "洞窟{}_覆斗_{}".format(cave_name, angle_y)
        slope.scale = (CAVE_DEPTH * 0.6, CAVE_WIDTH * 0.4, 1)
        slope.rotation_euler = (math.radians(25), 0, math.radians(angle_y))
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        slope.data.materials.append(slope_mat)

    # --- 壁画布置（分洞窟差异化）---
    if cave_name == "285":
        create_cave_murals_285(cave_name, x_start, x_center, y_min, y_max)
    elif cave_name == "45":
        create_cave_murals_45(cave_name, x_start, x_center, y_min, y_max)
    elif cave_name == "217":
        create_cave_murals_217(cave_name, x_start, x_center, y_min, y_max)
    elif cave_name == "17":
        create_cave_murals_17(cave_name, x_start, x_center, y_min, y_max)
    elif cave_name == "3":
        create_cave_murals_3(cave_name, x_start, x_center, y_min, y_max)

    # --- 彩塑人像（分洞窟差异化）---
    if cave_name == "285":
        create_cave_sculptures_285(cave_name, x_start, x_center, y_center)
    elif cave_name == "45":
        create_cave_sculptures_45(cave_name, x_start, x_center, y_center)
    elif cave_name == "217":
        create_cave_sculptures_217(cave_name, x_start, x_center, y_center)
    elif cave_name == "17":
        create_cave_sculptures_17(cave_name, x_start, x_center, y_center)
    elif cave_name == "3":
        create_cave_sculptures_3(cave_name, x_start, x_center, y_center)

    # --- 玻璃护栏 ---
    glass_mat = create_material("洞窟{}_玻璃护栏".format(cave_name), (0.8, 0.8, 0.8), roughness=0.1)
    add_box("洞窟{}_护栏".format(cave_name),
            (x_start + 1.2, y_center, 0.5),
            (0.05, CAVE_WIDTH - 1.0, 1.0), glass_mat)

    print("  洞窟{}窟完成".format(cave_name))


def create_cave_murals_285(cave_name, x_start, x_center, y_min, y_max):
    """285窟（西魏）壁画：覆斗形窟顶、伏羲女娲神话壁画、飞天藻井加大"""
    # 壁画尺寸
    mural_w = 2.5
    mural_h = 1.5
    upper_z = CAVE_HEIGHT * 0.75
    dynasty = "西魏"

    # 左墙上层 - 飞天（伏羲女娲神话题材，使用285窟专属图片）
    apsara_path = os.path.join(IMAGE_DIR, CAVE_285_IMAGES["flying_apsara"])
    apsara_mat = create_cave_mural_material(
        "洞窟{}_飞天".format(cave_name), apsara_path,
        COLOR_SHIQING, "flying", dynasty)
    add_plane("洞窟{}_左墙_飞天".format(cave_name),
              (x_center, y_min + 0.15, upper_z),
              (mural_w, mural_h, 1), apsara_mat,
              rotation=(math.radians(90), 0, 0))

    # 右墙上层 - 天宫伎乐（神话题材，使用285窟专属图片）
    musician_path = os.path.join(IMAGE_DIR, CAVE_285_IMAGES["celestial_musicians"])
    musician_mat = create_cave_mural_material(
        "洞窟{}_伎乐".format(cave_name), musician_path,
        COLOR_SHIQING, "flying", dynasty)
    add_plane("洞窟{}_右墙_伎乐".format(cave_name),
              (x_center, y_max - 0.15, upper_z),
              (mural_w, mural_h, 1), musician_mat,
              rotation=(math.radians(90), 0, math.radians(180)))

    # 飞天藻井加大（285窟核心视觉C位，藻井图片尺寸加大，使用285窟专属图片）
    caisson_path = os.path.join(IMAGE_DIR, CAVE_285_IMAGES["caisson"])
    caisson_large_mat = create_cave_mural_material(
        "洞窟{}_飞天藻井加大".format(cave_name), caisson_path,
        COLOR_SHIQING, "caisson", dynasty)
    add_plane("洞窟{}_藻井加大".format(cave_name),
              (x_center, 0, CAVE_HEIGHT - 0.06),
              (4.5, 4.5, 1), caisson_large_mat)

    # 后墙中部 - 西魏神话经变画（使用285窟专属图片）
    mid_z = 1.55
    sutra_path = os.path.join(IMAGE_DIR, CAVE_285_IMAGES["sutra"])
    sutra_mat = create_cave_mural_material(
        "洞窟{}_经变画".format(cave_name), sutra_path,
        COLOR_TUHUANG, "sutra", dynasty)
    add_plane("洞窟{}_后墙_经变画".format(cave_name),
              (x_start + CAVE_DEPTH - 0.2, 0, mid_z),
              (3.0, 2.0, 1), sutra_mat,
              rotation=(math.radians(90), 0, math.radians(-90)))

    # 墙面底部：供养人（使用285窟专属图片）
    bottom_z = 0.6
    donor_path = os.path.join(IMAGE_DIR, CAVE_285_IMAGES["donors"])
    donor_mat = create_cave_mural_material(
        "洞窟{}_供养人".format(cave_name), donor_path,
        COLOR_ZHESHI, "donor", dynasty)
    add_plane("洞窟{}_左墙_供养人".format(cave_name),
              (x_center - 1.5, y_min + 0.15, bottom_z),
              (2.0, 1.0, 1), donor_mat,
              rotation=(math.radians(90), 0, 0))


def create_3d_statue(name, location, statue_type, base_height, material_color,
                     base_style='default', disciple_type=None, extra_arms=False):
    """
    创建3D立体人像雕塑（高级建模：细分曲面+精细面部+莲花座+背光）
    参数:
        name: 雕塑名称
        location: 基座底部中心位置 (x, y, z)
        statue_type: 雕塑类型 ('buddha', 'bodhisattva', 'disciple', 'guardian', 'donor')
        base_height: 基座高度
        material_color: 雕塑材质颜色 (r, g, b)
        base_style: 基座风格 ('default'默认方块, 'simple_stone'简洁石质,
                    'lotus_sumeru'莲花须弥座, 'double_sumeru'双层束腰须弥座,
                    'sutra_platform'经卷展台, 'mandala'密宗坛城)
        disciple_type: 弟子类型 ('kasyapa'迦叶老者, 'ananda'阿难少者)，仅 disciple 类型有效
        extra_arms: 是否创建多臂效果（千手观音专用）
    返回: 合并后的雕塑对象
    """
    x, y, z = location

    # 根据 statue_type 调整身体比例与材质参数
    if statue_type == 'buddha':
        # 佛陀：盘坐姿势，身体宽胖，头部大，金质感
        head_r = 0.30
        body_r = 0.45
        body_h = 0.80
        arm_r = 0.10
        arm_h = 0.50
        leg_r = 0.13
        leg_h = 0.35
        arm_tilt = 15
        leg_spread = 0.30
        metallic = 0.65
        roughness = 0.35
        has_backlight = True
        has_usnisa = True       # 肉髻
        has_crown = False
        has_wrinkles = False
        has_fangs = False
    elif statue_type == 'bodhisattva':
        # 菩萨：站立优雅，身体修长，宝冠装饰
        head_r = 0.22
        body_r = 0.28
        body_h = 1.20
        arm_r = 0.07
        arm_h = 0.70
        leg_r = 0.09
        leg_h = 0.90
        arm_tilt = 10
        leg_spread = 0.16
        metallic = 0.55
        roughness = 0.40
        has_backlight = True
        has_usnisa = False
        has_crown = True
        has_wrinkles = False
        has_fangs = False
    elif statue_type == 'disciple':
        # 弟子：站立，略弯腰，根据 disciple_type 区分迦叶（老者）和阿难（少者）
        head_r = 0.23
        body_r = 0.30
        body_h = 1.00
        arm_r = 0.08
        arm_h = 0.60
        leg_r = 0.10
        leg_h = 0.80
        arm_tilt = 8
        leg_spread = 0.18
        metallic = 0.15
        roughness = 0.75
        has_backlight = False
        has_usnisa = False
        has_crown = False
        has_fangs = False
        # 根据 disciple_type 区分迦叶（老者有皱纹）和阿难（少者无皱纹）
        if disciple_type == 'ananda':
            # 阿难：少者，面容清秀，无皱纹，脸颊饱满
            has_wrinkles = False
        else:
            # 迦叶（默认）：老者，有皱纹，弯腰前倾更明显
            has_wrinkles = True
    elif statue_type == 'guardian':
        # 护法：动态姿势，身体粗壮，威猛形貌
        head_r = 0.26
        body_r = 0.40
        body_h = 0.95
        arm_r = 0.12
        arm_h = 0.65
        leg_r = 0.14
        leg_h = 0.75
        arm_tilt = 45  # 动态姿势更夸张：手臂张开角度加大
        leg_spread = 0.28
        metallic = 0.30
        roughness = 0.60
        has_backlight = False
        has_usnisa = False
        has_crown = False
        has_wrinkles = False
        has_fangs = True
    else:
        # donor：供养人，站立，较小尺寸
        head_r = 0.20
        body_r = 0.25
        body_h = 0.85
        arm_r = 0.06
        arm_h = 0.50
        leg_r = 0.08
        leg_h = 0.70
        arm_tilt = 6
        leg_spread = 0.14
        metallic = 0.10
        roughness = 0.80
        has_backlight = False
        has_usnisa = False
        has_crown = False
        has_wrinkles = False
        has_fangs = False

    # 基座顶部Z坐标
    base_top_z = z + base_height
    # 基座宽度（根据基座高度推算）
    base_w = max(base_height + 0.2, 0.4)

    # 基座材质（做旧土色）
    base_mat = create_material("基座_{}".format(name), (0.40, 0.32, 0.22), roughness=0.85)
    # 雕塑材质（按类型细化金属度与粗糙度）
    statue_mat = create_material("彩塑_{}".format(name), material_color,
                                roughness=roughness, metallic=metallic)
    # 莲花座材质（金/石质感）
    lotus_mat = create_material("莲花座_{}".format(name), (0.85, 0.70, 0.35),
                                roughness=0.45, metallic=0.50)

    parts = []

    # 基座创建（根据 base_style 创建不同风格的基座）
    if base_style == 'simple_stone':
        # 285窟：简洁石质方形基座，低矮朴素，粗糙度高增强石质纹理感
        stone_mat = create_material("石质基座_{}".format(name),
                                    (0.42, 0.34, 0.24), roughness=0.98)
        base = add_box("基座_{}".format(name),
                       (x, y, z + base_height / 2),
                       (base_w, base_w, base_height), stone_mat)
        parts.append(base)
        # 石质纹理装饰：基座四周增加细长凹槽模拟石纹
        groove_mat = create_material("石纹_{}".format(name),
                                     (0.30, 0.24, 0.16), roughness=0.99)
        for gi in range(2):
            gz = z + base_height * (0.3 + gi * 0.4)
            add_box("石纹_{}_{}".format(name, gi),
                    (x, y, gz),
                    (base_w * 1.01, base_w * 0.05, 0.03), groove_mat)
            parts.append(bpy.context.active_object)

    elif base_style == 'lotus_sumeru':
        # 45窟：华丽莲花须弥座，基座上方增加一圈莲花瓣装饰
        # 下层基座（较宽）
        base_lower = add_box("基座下_{}".format(name),
                             (x, y, z + base_height * 0.25),
                             (base_w * 1.2, base_w * 1.2, base_height * 0.5), base_mat)
        parts.append(base_lower)
        # 上层基座（较窄）
        base_upper = add_box("基座上_{}".format(name),
                             (x, y, z + base_height * 0.65),
                             (base_w * 0.9, base_w * 0.9, base_height * 0.3), base_mat)
        parts.append(base_upper)
        # 莲花瓣装饰圈（扁球体排列成圆形，环绕基座顶部）
        lotus_deco_count = 16
        lotus_deco_radius = base_w * 0.55
        lotus_deco_z = z + base_height * 0.85
        for i in range(lotus_deco_count):
            angle = (2 * math.pi / lotus_deco_count) * i
            deco_x = x + math.cos(angle) * lotus_deco_radius
            deco_y = y + math.sin(angle) * lotus_deco_radius
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06,
                                                  location=(deco_x, deco_y, lotus_deco_z))
            deco_petal = bpy.context.active_object
            deco_petal.name = "须弥莲瓣_{}_{}".format(name, i)
            deco_petal.scale = (1.0, 0.5, 0.7)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            deco_petal.data.materials.append(lotus_mat)
            parts.append(deco_petal)

    elif base_style == 'double_sumeru':
        # 217窟：双层束腰须弥座，基座分上下两层，中间有束腰收窄
        # 下层基座（较宽）
        base_lower = add_box("基座下_{}".format(name),
                             (x, y, z + base_height * 0.30),
                             (base_w * 1.15, base_w * 1.15, base_height * 0.6), base_mat)
        parts.append(base_lower)
        # 束腰部分（收窄）
        waist_mat = create_material("束腰_{}".format(name),
                                    (0.50, 0.40, 0.26), roughness=0.80)
        base_waist = add_box("束腰_{}".format(name),
                             (x, y, z + base_height * 0.70),
                             (base_w * 0.65, base_w * 0.65, base_height * 0.2), waist_mat)
        parts.append(base_waist)
        # 上层基座（较窄）
        base_upper = add_box("基座上_{}".format(name),
                             (x, y, z + base_height * 0.90),
                             (base_w * 0.85, base_w * 0.85, base_height * 0.2), base_mat)
        parts.append(base_upper)

    elif base_style == 'sutra_platform':
        # 17窟：经卷展台风格，基座较矮且宽，顶部有经卷装饰
        platform_w = base_w * 1.4
        platform_h = base_height * 0.7
        base = add_box("经卷展台_{}".format(name),
                       (x, y, z + platform_h / 2),
                       (platform_w, platform_w, platform_h), base_mat)
        parts.append(base)
        # 顶部经卷装饰（扁长方体模拟展开的经卷）
        sutra_mat = create_material("经卷_{}".format(name),
                                    (0.55, 0.45, 0.30), roughness=0.75)
        sutra_roll = add_box("经卷装饰_{}".format(name),
                             (x, y, z + platform_h + 0.03),
                             (platform_w * 0.7, platform_w * 0.5, 0.06), sutra_mat)
        parts.append(sutra_roll)
        # 经卷两端卷轴（圆柱体）
        for sy in [-1, 1]:
            bpy.ops.mesh.primitive_cylinder_add(
                radius=0.05, depth=platform_w * 0.5, vertices=16,
                location=(x, y + sy * platform_w * 0.25, z + platform_h + 0.03))
            roll = bpy.context.active_object
            roll.name = "经卷轴_{}_{}".format(name, sy)
            roll.rotation_euler = (math.radians(90), 0, 0)
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
            roll.data.materials.append(sutra_mat)
            parts.append(roll)
        # 更新基座顶部Z坐标（经卷展台较矮）
        base_top_z = z + platform_h + 0.06

    elif base_style == 'mandala':
        # 3窟：密宗坛城风格，基座为圆形阶梯状（圆柱体堆叠）
        mandala_mat = create_material("坛城基座_{}".format(name),
                                      (0.45, 0.35, 0.22), roughness=0.82)
        # 三层圆形阶梯（从下到上逐渐缩小）
        mandala_layers = [
            (base_w * 0.70, base_height * 0.40),  # 底层最宽
            (base_w * 0.55, base_height * 0.35),  # 中层
            (base_w * 0.40, base_height * 0.25),  # 顶层最窄
        ]
        current_z = z
        for mi, (layer_r, layer_h) in enumerate(mandala_layers):
            bpy.ops.mesh.primitive_cylinder_add(
                radius=layer_r, depth=layer_h, vertices=32,
                location=(x, y, current_z + layer_h / 2))
            mandala_layer = bpy.context.active_object
            mandala_layer.name = "坛城层_{}_{}".format(name, mi)
            mandala_layer.data.materials.append(mandala_mat)
            parts.append(mandala_layer)
            current_z += layer_h
        # 坛城顶部莲花装饰圈
        mandala_deco_count = 8
        mandala_deco_radius = base_w * 0.30
        for i in range(mandala_deco_count):
            angle = (2 * math.pi / mandala_deco_count) * i
            deco_x = x + math.cos(angle) * mandala_deco_radius
            deco_y = y + math.sin(angle) * mandala_deco_radius
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05,
                                                  location=(deco_x, deco_y, current_z))
            mandala_deco = bpy.context.active_object
            mandala_deco.name = "坛城饰_{}_{}".format(name, i)
            mandala_deco.scale = (1.0, 0.5, 0.6)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            mandala_deco.data.materials.append(lotus_mat)
            parts.append(mandala_deco)

    else:
        # 默认：简单方块基座（保持原有逻辑）
        base = add_box("基座_{}".format(name),
                       (x, y, z + base_height / 2),
                       (base_w, base_w, base_height), base_mat)
        parts.append(base)

    # 莲花座（中心圆柱 + 周围莲瓣）
    lotus_center_z = base_top_z + 0.05
    bpy.ops.mesh.primitive_cylinder_add(radius=body_r * 0.85, depth=0.10,
                                        vertices=32, location=(x, y, lotus_center_z))
    lotus_center = bpy.context.active_object
    lotus_center.name = "{}_莲花座中心".format(name)
    lotus_center.data.materials.append(lotus_mat)
    parts.append(lotus_center)

    # 12片莲瓣（UV Sphere 排列成圆形，压扁成瓣状）
    lotus_petal_count = 12
    lotus_radius = body_r * 0.80
    for i in range(lotus_petal_count):
        angle = (2 * math.pi / lotus_petal_count) * i
        petal_x = x + math.cos(angle) * lotus_radius
        petal_y = y + math.sin(angle) * lotus_radius
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.08, location=(petal_x, petal_y, lotus_center_z))
        petal = bpy.context.active_object
        petal.name = "{}_莲瓣_{}".format(name, i)
        petal.scale = (1.0, 0.4, 0.5)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        petal.data.materials.append(lotus_mat)
        parts.append(petal)
    # 身体/躯干（32段圆柱，便于细分曲面平滑）
    body_z = base_top_z + 0.10 + body_h / 2
    bpy.ops.mesh.primitive_cylinder_add(radius=body_r, depth=body_h, vertices=32,
                                        location=(x, y, body_z))
    body = bpy.context.active_object
    body.name = "{}_身体".format(name)
    # 菩萨优雅站姿：身体轻微倾斜S曲线；弟子弯腰姿态更明显
    if statue_type == 'bodhisattva':
        body.rotation_euler = (math.radians(5), 0, math.radians(3))  # 轻微倾斜S曲线
    elif statue_type == 'disciple':
        body.rotation_euler = (math.radians(10), 0, 0)  # 弯腰前倾姿态
    elif statue_type == 'guardian':
        body.rotation_euler = (0, 0, math.radians(-8))  # 动态姿势：身体侧扭
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    body.data.materials.append(statue_mat)
    parts.append(body)

    # 肩部曲线（横向圆环，体现肩膀宽度）
    shoulder_z = body_z + body_h * 0.40
    bpy.ops.mesh.primitive_torus_add(major_radius=body_r * 1.05, minor_radius=0.06,
                                     location=(x, y, shoulder_z))
    shoulder = bpy.context.active_object
    shoulder.name = "{}_肩部".format(name)
    shoulder.data.materials.append(statue_mat)
    parts.append(shoulder)

    # 胸部曲线（仅佛陀，体现丰满胸部）
    if statue_type == 'buddha':
        chest_z = body_z + body_h * 0.15
        bpy.ops.mesh.primitive_torus_add(major_radius=body_r * 0.90, minor_radius=0.08,
                                         location=(x, y, chest_z))
        chest = bpy.context.active_object
        chest.name = "{}_胸部".format(name)
        chest.data.materials.append(statue_mat)
        parts.append(chest)

    # 腹部曲线（体现腰腹起伏）
    abdomen_z = body_z - body_h * 0.30
    bpy.ops.mesh.primitive_torus_add(major_radius=body_r * 0.95, minor_radius=0.05,
                                     location=(x, y, abdomen_z))
    abdomen = bpy.context.active_object
    abdomen.name = "{}_腹部".format(name)
    abdomen.data.materials.append(statue_mat)
    parts.append(abdomen)

    # 手臂（左右各一，16段圆柱 + 肘部关节球体）
    arm_z = body_z + body_h * 0.15
    for side, sign in [("左", -1), ("右", 1)]:
        arm_x = x + sign * (body_r + arm_r * 0.3)
        bpy.ops.mesh.primitive_cylinder_add(radius=arm_r, depth=arm_h, vertices=16,
                                            location=(arm_x, y, arm_z))
        arm = bpy.context.active_object
        arm.name = "{}_{}臂".format(name, side)
        arm.rotation_euler = (0, math.radians(arm_tilt * sign), 0)
        arm.data.materials.append(statue_mat)
        parts.append(arm)
        # 肘部小球体（关节）
        elbow_z = arm_z - arm_h / 2 * 0.6
        elbow_x = arm_x + sign * arm_h * 0.3 * math.sin(math.radians(arm_tilt))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=arm_r * 1.1, location=(elbow_x, y, elbow_z))
        elbow = bpy.context.active_object
        elbow.name = "{}_{}肘".format(name, side)
        elbow.data.materials.append(statue_mat)
        parts.append(elbow)
        # 手部（球体，位于手臂末端，增强三维观赏性）
        hand_z = elbow_z - arm_h * 0.35
        hand_x = elbow_x + sign * arm_h * 0.2 * math.sin(math.radians(arm_tilt))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=arm_r * 1.3, location=(hand_x, y, hand_z))
        hand = bpy.context.active_object
        hand.name = "{}_{}手".format(name, side)
        hand.scale = (1.0, 0.6, 1.2)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        hand.data.materials.append(statue_mat)
        parts.append(hand)

    # 多臂效果（千手观音专用，用多个细长圆柱体模拟手臂呈扇形展开）
    if extra_arms:
        extra_arm_count = 10  # 每侧5对手臂
        extra_arm_r = arm_r * 0.6  # 细长手臂
        extra_arm_h = arm_h * 0.85
        for side_idx in range(extra_arm_count):
            # 左右对称分布，角度从上到下递增
            angle_step = 15  # 每对手臂间隔15度
            base_angle = (side_idx - (extra_arm_count - 1) / 2) * angle_step
            for side, sign in [("左", -1), ("右", 1)]:
                arm_angle = base_angle * sign
                # 手臂从肩部向外辐射
                arm_offset_x = sign * (body_r + extra_arm_r * 0.2)
                arm_z_pos = shoulder_z - abs(side_idx - (extra_arm_count - 1) / 2) * 0.08
                bpy.ops.mesh.primitive_cylinder_add(
                    radius=extra_arm_r, depth=extra_arm_h, vertices=12,
                    location=(arm_offset_x, y, arm_z_pos))
                extra_arm = bpy.context.active_object
                extra_arm.name = "{}_千手{}_{}".format(name, side, side_idx)
                # 手臂向外辐射倾斜
                extra_arm.rotation_euler = (0, math.radians(arm_angle), 0)
                bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
                extra_arm.data.materials.append(statue_mat)
                parts.append(extra_arm)
                # 手臂末端小球体（手掌）
                hand_offset = sign * extra_arm_h * 0.5 * math.sin(math.radians(arm_angle))
                hand_z_off = arm_z_pos - extra_arm_h * 0.5 * math.cos(math.radians(arm_angle))
                bpy.ops.mesh.primitive_uv_sphere_add(
                    radius=extra_arm_r * 1.0,
                    location=(arm_offset_x + hand_offset, y, hand_z_off))
                extra_hand = bpy.context.active_object
                extra_hand.name = "{}_千手掌{}_{}".format(name, side, side_idx)
                extra_hand.scale = (0.8, 0.5, 1.0)
                bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
                extra_hand.data.materials.append(statue_mat)
                parts.append(extra_hand)

    # 腿部（左右各一，16段圆柱）
    leg_z = base_top_z + 0.10 + leg_h / 2
    for side, sign in [("左", -1), ("右", 1)]:
        leg_x = x + sign * leg_spread
        bpy.ops.mesh.primitive_cylinder_add(radius=leg_r, depth=leg_h, vertices=16,
                                            location=(leg_x, y, leg_z))
        leg = bpy.context.active_object
        leg.name = "{}_{}腿".format(name, side)
        leg.data.materials.append(statue_mat)
        parts.append(leg)
        # 脚部（扁球体，位于腿部末端，增强三维观赏性）
        foot_z = base_top_z + 0.05
        bpy.ops.mesh.primitive_uv_sphere_add(radius=leg_r * 1.4, location=(leg_x, y - leg_r * 0.3, foot_z))
        foot = bpy.context.active_object
        foot.name = "{}_{}脚".format(name, side)
        foot.scale = (1.0, 1.8, 0.5)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        foot.data.materials.append(statue_mat)
        parts.append(foot)

    # 衣纹（6条细长立方体，环绕身体表现袈裟褶皱）
    for i in range(6):
        fold_z = body_z - body_h * 0.30 + i * (body_h * 0.15)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, fold_z))
        fold = bpy.context.active_object
        fold.name = "{}_衣纹_{}".format(name, i)
        fold.scale = (body_r * 2.05, 0.04, 0.04)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        fold.data.materials.append(statue_mat)
        parts.append(fold)

    # 头部（ICO Sphere 细分2级，造型更圆润）
    head_z = body_z + body_h / 2 + head_r
    bpy.ops.mesh.primitive_ico_sphere_add(radius=head_r, subdivisions=2, location=(x, y, head_z))
    head = bpy.context.active_object
    head.name = "{}_头部".format(name)
    head.data.materials.append(statue_mat)
    parts.append(head)

    # 面部特征（面朝 -Y 方向构建，旋转后朝 -X 方向）
    # 眼睛凹陷（两个小球体，位于面部 -Y 侧）
    eye_y = y - head_r * 0.80
    eye_z = head_z + head_r * 0.10
    # 根据雕塑类型调整眼睛大小：佛陀微闭（缩小）、护法怒目（加大）、菩萨凤眼（细长）
    if statue_type == 'buddha':
        eye_radius_scale = 0.08  # 佛陀双目微闭，眼睛缩小
    elif statue_type == 'guardian':
        eye_radius_scale = 0.18  # 护法怒目圆睁，眼睛加大
    elif statue_type == 'bodhisattva':
        eye_radius_scale = 0.10  # 菩萨凤眼微垂，眼睛细长
    else:
        eye_radius_scale = 0.12  # 默认眼睛大小
    for side, sign in [("左", -1), ("右", 1)]:
        eye_x = x + sign * head_r * 0.35
        bpy.ops.mesh.primitive_uv_sphere_add(radius=head_r * eye_radius_scale, location=(eye_x, eye_y, eye_z))
        eye = bpy.context.active_object
        eye.name = "{}_{}眼".format(name, side)
        # 佛陀眼睛微闭：压扁并倾斜；护法怒目：略微突出；菩萨凤眼微垂：向下倾斜
        if statue_type == 'buddha':
            eye.scale = (1.2, 0.5, 0.6)  # 微闭：压扁成细长眼形
            eye.rotation_euler = (0, math.radians(sign * 15), 0)  # 略微倾斜
        elif statue_type == 'guardian':
            eye.scale = (1.3, 1.2, 1.3)  # 怒目：略微放大突出
        elif statue_type == 'bodhisattva':
            eye.scale = (1.3, 0.4, 0.5)  # 凤眼微垂：压扁成细长弧形
            eye.rotation_euler = (math.radians(sign * 10), math.radians(sign * 20), 0)  # 向下倾斜
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        eye.data.materials.append(statue_mat)
        parts.append(eye)

    # 佛陀眼睑线条（细长立方体，模拟微闭眼睑）
    if statue_type == 'buddha':
        eyelid_y = y - head_r * 0.82
        eyelid_z = head_z + head_r * 0.12
        for side, sign in [("左", -1), ("右", 1)]:
            eyelid_x = x + sign * head_r * 0.35
            bpy.ops.mesh.primitive_cube_add(size=1, location=(eyelid_x, eyelid_y, eyelid_z))
            eyelid = bpy.context.active_object
            eyelid.name = "{}_{}眼睑".format(name, side)
            eyelid.scale = (head_r * 0.20, 0.02, 0.02)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            eyelid.data.materials.append(statue_mat)
            parts.append(eyelid)

    # 护法怒眉（倾斜的立方体，模拟皱起的眉毛）
    if statue_type == 'guardian':
        brow_y = y - head_r * 0.75
        brow_z = head_z + head_r * 0.25
        for side, sign in [("左", -1), ("右", 1)]:
            brow_x = x + sign * head_r * 0.35
            bpy.ops.mesh.primitive_cube_add(size=1, location=(brow_x, brow_y, brow_z))
            brow = bpy.context.active_object
            brow.name = "{}_{}怒眉".format(name, side)
            brow.scale = (head_r * 0.25, 0.03, 0.04)
            # 怒眉向内倾斜（眉头低、眉尾高）
            brow.rotation_euler = (0, math.radians(sign * 25), 0)
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
            brow.data.materials.append(statue_mat)
            parts.append(brow)

    # 鼻子（锥体，凸出于面部 -Y 侧）
    nose_y = y - head_r * 0.85
    nose_z = head_z - head_r * 0.05
    bpy.ops.mesh.primitive_cone_add(radius1=head_r * 0.12, depth=head_r * 0.25,
                                    location=(x, nose_y, nose_z))
    nose = bpy.context.active_object
    nose.name = "{}_鼻".format(name)
    nose.rotation_euler = (math.radians(90), 0, 0)
    nose.data.materials.append(statue_mat)
    parts.append(nose)

    # 嘴唇（Torus，横向放置于面部）
    lip_y = y - head_r * 0.78
    lip_z = head_z - head_r * 0.25
    bpy.ops.mesh.primitive_torus_add(major_radius=head_r * 0.18, minor_radius=head_r * 0.04,
                                     location=(x, lip_y, lip_z))
    lip = bpy.context.active_object
    lip.name = "{}_唇".format(name)
    lip.rotation_euler = (math.radians(90), 0, 0)
    # 佛陀微笑表情：嘴唇两端微微上扬（通过缩放变形模拟微笑弧度）
    if statue_type == 'buddha':
        lip.scale = (1.0, 1.0, 0.8)  # 微微压扁，形成含笑弧线
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # 菩萨嘴角含笑：嘴唇两端微微上翘
    elif statue_type == 'bodhisattva':
        lip.scale = (1.1, 0.8, 0.7)  # 略微拉宽压扁，形成含笑弧线
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    lip.data.materials.append(statue_mat)
    parts.append(lip)

    # 佛陀笑窝（嘴角两侧小球体，模拟微笑酒窝）
    if statue_type == 'buddha':
        for side, sign in [("左", -1), ("右", 1)]:
            dimple_x = x + sign * head_r * 0.22
            bpy.ops.mesh.primitive_uv_sphere_add(radius=head_r * 0.04,
                                                  location=(dimple_x, lip_y, lip_z))
            dimple = bpy.context.active_object
            dimple.name = "{}_{}笑窝".format(name, side)
            dimple.data.materials.append(statue_mat)
            parts.append(dimple)

    # 耳朵（左右各一，带耳垂）
    for side, sign in [("左", -1), ("右", 1)]:
        ear_x = x + sign * head_r * 0.85
        ear_y = y - head_r * 0.10
        ear_z = head_z + head_r * 0.05
        # 耳廓（扁球体）
        bpy.ops.mesh.primitive_uv_sphere_add(radius=head_r * 0.20, location=(ear_x, ear_y, ear_z))
        ear = bpy.context.active_object
        ear.name = "{}_{}耳".format(name, side)
        ear.scale = (0.3, 1.0, 1.2)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        ear.data.materials.append(statue_mat)
        parts.append(ear)
        # 耳垂（下垂小球体，佛陀/菩萨耳垂较长）
        lobe_size = head_r * 0.14 if statue_type in ('buddha', 'bodhisattva') else head_r * 0.08
        lobe_z = ear_z - head_r * 0.22
        bpy.ops.mesh.primitive_uv_sphere_add(radius=lobe_size, location=(ear_x, ear_y, lobe_z))
        lobe = bpy.context.active_object
        lobe.name = "{}_{}耳垂".format(name, side)
        lobe.data.materials.append(statue_mat)
        parts.append(lobe)

    # 面颊增强（根据雕塑类型增加不同的面颊效果）
    cheek_y = y - head_r * 0.55
    cheek_z = head_z - head_r * 0.10
    if statue_type == 'buddha':
        # 佛陀面颊丰满（两侧较大球体）
        for side, sign in [("左", -1), ("右", 1)]:
            cheek_x = x + sign * head_r * 0.55
            bpy.ops.mesh.primitive_uv_sphere_add(radius=head_r * 0.15,
                                                  location=(cheek_x, cheek_y, cheek_z))
            cheek = bpy.context.active_object
            cheek.name = "{}_{}面颊".format(name, side)
            cheek.scale = (0.8, 0.6, 1.0)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            cheek.data.materials.append(statue_mat)
            parts.append(cheek)
    elif statue_type == 'guardian':
        # 护法颧骨突出（两侧球体，增强威猛面相）
        for side, sign in [("左", -1), ("右", 1)]:
            cheek_x = x + sign * head_r * 0.50
            bpy.ops.mesh.primitive_uv_sphere_add(radius=head_r * 0.12,
                                                  location=(cheek_x, cheek_y, cheek_z))
            cheek = bpy.context.active_object
            cheek.name = "{}_{}颧骨".format(name, side)
            cheek.scale = (0.7, 0.5, 1.0)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            cheek.data.materials.append(statue_mat)
            parts.append(cheek)
    elif statue_type == 'disciple' and disciple_type == 'ananda':
        # 阿难面容清秀，脸颊饱满（年轻感）
        for side, sign in [("左", -1), ("右", 1)]:
            cheek_x = x + sign * head_r * 0.45
            bpy.ops.mesh.primitive_uv_sphere_add(radius=head_r * 0.10,
                                                  location=(cheek_x, cheek_y, cheek_z))
            cheek = bpy.context.active_object
            cheek.name = "{}_{}面颊".format(name, side)
            cheek.scale = (0.7, 0.5, 0.9)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            cheek.data.materials.append(statue_mat)
            parts.append(cheek)

    # 佛陀白毫相（额头中央小圆点，用小球体）
    if statue_type == 'buddha':
        urna_y = y - head_r * 0.82
        urna_z = head_z + head_r * 0.30
        bpy.ops.mesh.primitive_uv_sphere_add(radius=head_r * 0.05,
                                              location=(x, urna_y, urna_z))
        urna = bpy.context.active_object
        urna.name = "{}_白毫相".format(name)
        urna_mat = create_material("白毫_{}".format(name), (0.95, 0.85, 0.40),
                                   roughness=0.30, metallic=0.70)
        urna.data.materials.append(urna_mat)
        parts.append(urna)

    # 类型特殊面部特征
    if has_usnisa:
        # 佛陀肉髻（头顶凸起）
        usnisa_z = head_z + head_r * 1.05
        bpy.ops.mesh.primitive_uv_sphere_add(radius=head_r * 0.35, location=(x, y, usnisa_z))
        usnisa = bpy.context.active_object
        usnisa.name = "{}_肉髻".format(name)
        usnisa.data.materials.append(statue_mat)
        parts.append(usnisa)
        # 双下巴（佛陀丰满）
        chin_y = y - head_r * 0.60
        chin_z = head_z - head_r * 0.55
        bpy.ops.mesh.primitive_uv_sphere_add(radius=head_r * 0.18, location=(x, chin_y, chin_z))
        chin = bpy.context.active_object
        chin.name = "{}_双下巴".format(name)
        chin.data.materials.append(statue_mat)
        parts.append(chin)

    if has_crown:
        # 菩萨宝冠（头顶环状装饰）
        crown_z = head_z + head_r * 0.90
        bpy.ops.mesh.primitive_torus_add(major_radius=head_r * 0.95, minor_radius=head_r * 0.08,
                                         location=(x, y, crown_z))
        crown = bpy.context.active_object
        crown.name = "{}_宝冠".format(name)
        crown.data.materials.append(lotus_mat)
        parts.append(crown)
        # 宝冠中央装饰（小球体，位于额前）
        bpy.ops.mesh.primitive_uv_sphere_add(radius=head_r * 0.10,
                                             location=(x, y - head_r * 0.85, crown_z))
        crown_gem = bpy.context.active_object
        crown_gem.name = "{}_宝冠饰".format(name)
        crown_gem.data.materials.append(lotus_mat)
        parts.append(crown_gem)
        # 宝冠两侧装饰宝石（增强宝冠精致度）
        for side, sign in [("左", -1), ("右", 1)]:
            gem_x = x + sign * head_r * 0.70
            bpy.ops.mesh.primitive_uv_sphere_add(radius=head_r * 0.06,
                                                 location=(gem_x, y - head_r * 0.50, crown_z))
            side_gem = bpy.context.active_object
            side_gem.name = "{}_宝冠{}侧饰".format(name, side)
            side_gem.data.materials.append(lotus_mat)
            parts.append(side_gem)
        # 宝冠顶部尖饰（锥体，增强精致感）
        bpy.ops.mesh.primitive_cone_add(radius1=head_r * 0.08, depth=head_r * 0.30,
                                        location=(x, y, crown_z + head_r * 0.15))
        crown_top = bpy.context.active_object
        crown_top.name = "{}_宝冠尖饰".format(name)
        crown_top.data.materials.append(lotus_mat)
        parts.append(crown_top)

    if has_wrinkles:
        # 弟子皱纹（额头横纹，增强至4条细 Torus，体现老者沧桑感）
        for i in range(4):
            wrinkle_z = head_z + head_r * 0.45 - i * head_r * 0.12
            bpy.ops.mesh.primitive_torus_add(major_radius=head_r * 0.70, minor_radius=head_r * 0.015,
                                             location=(x, y - head_r * 0.30, wrinkle_z))
            wrinkle = bpy.context.active_object
            wrinkle.name = "{}_皱纹_{}".format(name, i)
            wrinkle.rotation_euler = (math.radians(90), 0, 0)
            wrinkle.data.materials.append(statue_mat)
            parts.append(wrinkle)
        # 法令纹（鼻翼两侧延伸纹路，迦叶老者法令纹加深：增大 minor_radius）
        for side, sign in [("左", -1), ("右", 1)]:
            nasion_x = x + sign * head_r * 0.15
            bpy.ops.mesh.primitive_torus_add(major_radius=head_r * 0.15, minor_radius=head_r * 0.020,
                                             location=(nasion_x, y - head_r * 0.55, head_z - head_r * 0.15))
            nasion = bpy.context.active_object
            nasion.name = "{}_法令纹_{}".format(name, side)
            nasion.rotation_euler = (math.radians(90), 0, math.radians(sign * 20))
            nasion.data.materials.append(statue_mat)
            parts.append(nasion)
        # 迦叶眼角鱼尾纹（额外增加老者特征，细 Torus 从眼角向太阳穴延伸）
        for side, sign in [("左", -1), ("右", 1)]:
            crow_x = x + sign * head_r * 0.55
            bpy.ops.mesh.primitive_torus_add(major_radius=head_r * 0.10, minor_radius=head_r * 0.010,
                                             location=(crow_x, y - head_r * 0.65, head_z + head_r * 0.05))
            crow = bpy.context.active_object
            crow.name = "{}_鱼尾纹_{}".format(name, side)
            crow.rotation_euler = (math.radians(90), 0, math.radians(sign * 35))
            crow.data.materials.append(statue_mat)
            parts.append(crow)

    if has_fangs:
        # 护法獠牙（两颗锥体，下唇下方）
        fang_y = y - head_r * 0.75
        fang_z = head_z - head_r * 0.35
        for side, sign in [("左", -1), ("右", 1)]:
            fang_x = x + sign * head_r * 0.10
            bpy.ops.mesh.primitive_cone_add(radius1=head_r * 0.04, depth=head_r * 0.18,
                                            location=(fang_x, fang_y, fang_z))
            fang = bpy.context.active_object
            fang.name = "{}_{}獠牙".format(name, side)
            fang.rotation_euler = (math.radians(-90), 0, 0)
            fang.data.materials.append(statue_mat)
            parts.append(fang)

    # 螺发（16个小 UV Sphere 球面分布于头顶）
    curl_count = 16
    curl_r = 0.02
    for i in range(curl_count):
        angle = (2 * math.pi / curl_count) * i
        curl_x = x + math.cos(angle) * head_r * 0.80
        curl_y = y + math.sin(angle) * head_r * 0.80
        curl_z = head_z + head_r * 0.55
        bpy.ops.mesh.primitive_uv_sphere_add(radius=curl_r, location=(curl_x, curl_y, curl_z))
        curl = bpy.context.active_object
        curl.name = "{}_螺发_{}".format(name, i)
        curl.data.materials.append(statue_mat)
        parts.append(curl)

    # 背光（仅佛陀与菩萨，Torus + 发光材质）
    if has_backlight:
        halo_color = (1.0, 0.85, 0.40) if statue_type == 'buddha' else (0.60, 0.85, 1.0)
        halo_mat = create_emissive_material("背光_{}".format(name), halo_color,
                                            strength=1.5, roughness=0.30)
        halo_z = body_z + body_h * 0.30
        bpy.ops.mesh.primitive_torus_add(major_radius=body_r * 1.60, minor_radius=0.08,
                                         location=(x, y, halo_z))
        halo = bpy.context.active_object
        halo.name = "{}_背光".format(name)
        halo.data.materials.append(halo_mat)
        parts.append(halo)

    # 选中所有部件并 join 成一个整体对象
    bpy.ops.object.select_all(action='DESELECT')
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()

    # 获取合并后的对象并命名
    statue = bpy.context.active_object
    statue.name = name

    # 添加细分曲面修改器（levels=2, render_levels=3）
    subsurf = statue.modifiers.new(name="Subdivision", type='SUBSURF')
    subsurf.levels = 2
    subsurf.render_levels = 3

    # 面向 -X 方向（面向洞窟入口），旋转 Z 轴 -90 度
    statue.rotation_euler = (0, 0, math.radians(-90))
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

    return statue


def create_cave_sculptures_285(cave_name, x_start, x_center, y_center):
    """285窟（西魏）彩塑：瘦骨清像西魏佛像（偏瘦削风格）"""
    # 佛龛位置（后墙前方）
    niche_x = x_start + CAVE_DEPTH - 1.5

    # 西魏瘦骨清像主佛（3D立体造像，居中，基座最高，简洁石质方形基座）
    create_3d_statue("彩塑{}_西魏佛".format(cave_name),
                     (niche_x, y_center, 0),
                     'buddha', BASE_BUDDHA, COLOR_TUHUANG,
                     base_style='simple_stone')

    # 两侧胁侍菩萨（瘦削风格，间距1.5m，稍微靠前形成纵深层次，简洁石质基座）
    for side, y_off in [("左", -1.5), ("右", 1.5)]:
        create_3d_statue("彩塑{}_{}胁侍".format(cave_name, side),
                         (niche_x - 0.4, y_center + y_off, 0),
                         'bodhisattva', BASE_BODHISATTVA, COLOR_SHIQING,
                         base_style='simple_stone')


def create_cave_murals_45(cave_name, x_start, x_center, y_min, y_max):
    """45窟（盛唐）壁画：盛唐经变画背景"""
    # 壁画尺寸
    mural_w = 2.5
    mural_h = 1.5
    upper_z = CAVE_HEIGHT * 0.75
    dynasty = "盛唐"

    # 左墙上层 - 飞天（使用45窟专属图片）
    apsara_path = os.path.join(IMAGE_DIR, CAVE_45_IMAGES["flying_apsara"])
    apsara_mat = create_cave_mural_material(
        "洞窟{}_飞天".format(cave_name), apsara_path,
        COLOR_TUHUANG, "flying", dynasty)
    add_plane("洞窟{}_左墙_飞天".format(cave_name),
              (x_center, y_min + 0.15, upper_z),
              (mural_w, mural_h, 1), apsara_mat,
              rotation=(math.radians(90), 0, 0))

    # 右墙上层 - 天宫伎乐（使用45窟专属图片）
    musician_path = os.path.join(IMAGE_DIR, CAVE_45_IMAGES["celestial_musicians"])
    musician_mat = create_cave_mural_material(
        "洞窟{}_伎乐".format(cave_name), musician_path,
        COLOR_TUHUANG, "flying", dynasty)
    add_plane("洞窟{}_右墙_伎乐".format(cave_name),
              (x_center, y_max - 0.15, upper_z),
              (mural_w, mural_h, 1), musician_mat,
              rotation=(math.radians(90), 0, math.radians(180)))

    # 后墙中部 - 盛唐经变画（使用45窟专属图片）
    mid_z = 1.55
    sutra_path = os.path.join(IMAGE_DIR, CAVE_45_IMAGES["sutra"])
    sutra_mat = create_cave_mural_material(
        "洞窟{}_经变画".format(cave_name), sutra_path,
        COLOR_ZHUSHA, "sutra", dynasty)
    add_plane("洞窟{}_后墙_经变画".format(cave_name),
              (x_start + CAVE_DEPTH - 0.2, 0, mid_z),
              (3.0, 2.0, 1), sutra_mat,
              rotation=(math.radians(90), 0, math.radians(-90)))

    # 墙面底部：供养人、市井生活（使用45窟专属图片）
    bottom_z = 0.6
    donor_path = os.path.join(IMAGE_DIR, CAVE_45_IMAGES["donors"])
    donor_mat = create_cave_mural_material(
        "洞窟{}_供养人".format(cave_name), donor_path,
        COLOR_ZHESHI, "donor", dynasty)
    add_plane("洞窟{}_左墙_供养人".format(cave_name),
              (x_center - 1.5, y_min + 0.15, bottom_z),
              (2.0, 1.0, 1), donor_mat,
              rotation=(math.radians(90), 0, 0))

    life_path = os.path.join(IMAGE_DIR, CAVE_45_IMAGES["daily_life"])
    life_mat = create_cave_mural_material(
        "洞窟{}_市井".format(cave_name), life_path,
        COLOR_TUHUANG, "daily_life", dynasty)
    add_plane("洞窟{}_右墙_市井".format(cave_name),
              (x_center - 1.5, y_max - 0.15, bottom_z),
              (2.0, 1.0, 1), life_mat,
              rotation=(math.radians(90), 0, math.radians(180)))


def create_cave_sculptures_45(cave_name, x_start, x_center, y_center):
    """
    45窟（盛唐）彩塑：完整复刻七身彩塑佛龛造像
    主佛、迦叶、阿难、胁侍菩萨x2、天王、力士
    核心镇馆之宝，主佛放在抬高独立展台
    弟子和菩萨错落分布，形成层次感
    """
    # 佛龛位置（后墙前方）
    niche_x = x_start + CAVE_DEPTH - 1.5

    # 主佛基座高度提升到 0.80（核心镇馆之宝C位）
    main_buddha_base = 0.80

    # 主佛（龛中心，抬高独立展台，3D立体造像，居中最高，华丽莲花须弥座）
    create_3d_statue("彩塑{}_主佛".format(cave_name),
                     (niche_x, y_center, 0),
                     'buddha', main_buddha_base, COLOR_TUHUANG,
                     base_style='lotus_sumeru')

    # 迦叶（佛身左侧，稍微靠前，3D立体造像，老者形貌，华丽莲花须弥座）
    create_3d_statue("彩塑{}_迦叶".format(cave_name),
                     (niche_x - 0.3, y_center - 1.2, 0),
                     'disciple', BASE_BODHISATTVA, COLOR_ZHESHI,
                     base_style='lotus_sumeru', disciple_type='kasyapa')

    # 阿难（佛身右侧，稍微靠前，3D立体造像，少者形貌，华丽莲花须弥座）
    create_3d_statue("彩塑{}_阿难".format(cave_name),
                     (niche_x - 0.3, y_center + 1.2, 0),
                     'disciple', BASE_BODHISATTVA, COLOR_ZHESHI,
                     base_style='lotus_sumeru', disciple_type='ananda')

    # 胁侍菩萨（弟子外侧，再靠前一层，3D立体造像，华丽莲花须弥座）
    create_3d_statue("彩塑{}_左菩萨".format(cave_name),
                     (niche_x - 0.5, y_center - 2.4, 0),
                     'bodhisattva', BASE_BODHISATTVA, COLOR_SHIQING,
                     base_style='lotus_sumeru')
    create_3d_statue("彩塑{}_右菩萨".format(cave_name),
                     (niche_x - 0.5, y_center + 2.4, 0),
                     'bodhisattva', BASE_BODHISATTVA, COLOR_SHIQING,
                     base_style='lotus_sumeru')

    # 天王（最外侧左，最靠前，3D立体造像，华丽莲花须弥座）
    create_3d_statue("彩塑{}_天王".format(cave_name),
                     (niche_x - 0.6, y_center - 2.8, 0),
                     'guardian', BASE_GUARDIAN, COLOR_ZHUSHA,
                     base_style='lotus_sumeru')

    # 力士（最外侧右，最靠前，3D立体造像，华丽莲花须弥座）
    create_3d_statue("彩塑{}_力士".format(cave_name),
                     (niche_x - 0.6, y_center + 2.8, 0),
                     'guardian', BASE_GUARDIAN, COLOR_ZHUSHA,
                     base_style='lotus_sumeru')


def create_cave_murals_217(cave_name, x_start, x_center, y_min, y_max):
    """217窟（盛唐）壁画：观无量寿经变完整壁画场景（尺寸加大）"""
    upper_z = CAVE_HEIGHT * 0.75
    dynasty = "盛唐"

    # 左墙上层 - 飞天（使用217窟专属图片）
    apsara_path = os.path.join(IMAGE_DIR, CAVE_217_IMAGES["flying_apsara"])
    apsara_mat = create_cave_mural_material(
        "洞窟{}_飞天".format(cave_name), apsara_path,
        COLOR_SHILV, "flying", dynasty)
    add_plane("洞窟{}_左墙_飞天".format(cave_name),
              (x_center, y_min + 0.15, upper_z),
              (2.5, 1.5, 1), apsara_mat,
              rotation=(math.radians(90), 0, 0))

    # 右墙上层 - 天宫伎乐（使用217窟专属图片）
    musician_path = os.path.join(IMAGE_DIR, CAVE_217_IMAGES["celestial_musicians"])
    musician_mat = create_cave_mural_material(
        "洞窟{}_伎乐".format(cave_name), musician_path,
        COLOR_SHILV, "flying", dynasty)
    add_plane("洞窟{}_右墙_伎乐".format(cave_name),
              (x_center, y_max - 0.15, upper_z),
              (2.5, 1.5, 1), musician_mat,
              rotation=(math.radians(90), 0, math.radians(180)))

    # 后墙中部 - 观无量寿经变主壁画（尺寸加大，核心展品，使用217窟专属图片）
    mid_z = 1.7
    sutra_path = os.path.join(IMAGE_DIR, CAVE_217_IMAGES["sutra"])
    sutra_mat = create_cave_mural_material(
        "洞窟{}_经变画".format(cave_name), sutra_path,
        COLOR_ZHUSHA, "sutra", dynasty)
    add_plane("洞窟{}_后墙_经变画".format(cave_name),
              (x_start + CAVE_DEPTH - 0.2, 0, mid_z),
              (4.0, 3.0, 1), sutra_mat,
              rotation=(math.radians(90), 0, math.radians(-90)))

    # 左墙底部 - 供养人壁画（使用217窟专属图片，补充壁画数量）
    bottom_z = 0.6
    donor_path = os.path.join(IMAGE_DIR, CAVE_217_IMAGES["donors"])
    donor_mat = create_cave_mural_material(
        "洞窟{}_供养人".format(cave_name), donor_path,
        COLOR_ZHESHI, "donor", dynasty)
    add_plane("洞窟{}_左墙_供养人".format(cave_name),
              (x_center - 1.5, y_min + 0.15, bottom_z),
              (2.0, 1.0, 1), donor_mat,
              rotation=(math.radians(90), 0, 0))

    # 右墙底部 - 藻井团花壁画（使用217窟专属图片，补充壁画数量）
    caisson_path = os.path.join(IMAGE_DIR, CAVE_217_IMAGES["caisson"])
    caisson_bottom_mat = create_cave_mural_material(
        "洞窟{}_右墙_藻井".format(cave_name), caisson_path,
        COLOR_SHIQING, "caisson", dynasty)
    add_plane("洞窟{}_右墙_藻井".format(cave_name),
              (x_center - 1.5, y_max - 0.15, bottom_z),
              (2.0, 1.0, 1), caisson_bottom_mat,
              rotation=(math.radians(90), 0, math.radians(180)))


def create_cave_sculptures_217(cave_name, x_start, x_center, y_center):
    """217窟（盛唐）彩塑：盛唐丰腴风格主佛+胁侍造像+供养菩萨（层次感布局）"""
    # 佛龛位置（后墙前方）
    niche_x = x_start + CAVE_DEPTH - 1.5

    # 盛唐丰腴风格主佛（3D立体造像，核心展品，居中最高，双层束腰须弥座）
    create_3d_statue("彩塑{}_主佛".format(cave_name),
                     (niche_x, y_center, 0),
                     'buddha', BASE_BUDDHA, COLOR_TUHUANG,
                     base_style='double_sumeru')

    # 盛唐丰腴风格胁侍菩萨（3D立体造像，稍微靠前形成层次，双层束腰须弥座）
    create_3d_statue("彩塑{}_左菩萨".format(cave_name),
                     (niche_x - 0.4, y_center - 1.5, 0),
                     'bodhisattva', BASE_BODHISATTVA, COLOR_SHIQING,
                     base_style='double_sumeru')
    create_3d_statue("彩塑{}_右菩萨".format(cave_name),
                     (niche_x - 0.4, y_center + 1.5, 0),
                     'bodhisattva', BASE_BODHISATTVA, COLOR_SHIQING,
                     base_style='double_sumeru')

    # 供养菩萨（小型，3D立体造像，最靠前形成纵深层次，双层束腰须弥座）
    create_3d_statue("彩塑{}_左供养菩萨".format(cave_name),
                     (niche_x - 0.5, y_center - 2.7, 0),
                     'disciple', BASE_GUARDIAN, COLOR_ZHESHI,
                     base_style='double_sumeru')
    create_3d_statue("彩塑{}_右供养菩萨".format(cave_name),
                     (niche_x - 0.5, y_center + 2.7, 0),
                     'disciple', BASE_GUARDIAN, COLOR_ZHESHI,
                     base_style='double_sumeru')


def create_cave_murals_17(cave_name, x_start, x_center, y_min, y_max):
    """17窟（晚唐藏经洞）壁画：藏经、绢画、文书陈列展台"""
    upper_z = CAVE_HEIGHT * 0.75
    dynasty = "晚唐"

    # 绢画展示（使用17窟专属图片，不再与洞窟重复）
    donor_path = os.path.join(IMAGE_DIR, CAVE_17_IMAGES["flying_apsara"])
    donor_mat = create_cave_mural_material(
        "洞窟{}_绢画_供养人".format(cave_name), donor_path,
        COLOR_ZHESHI, "donor", dynasty)
    # 左墙绢画
    add_plane("洞窟{}_左墙_绢画".format(cave_name),
              (x_center, y_min + 0.15, upper_z),
              (2.0, 1.5, 1), donor_mat,
              rotation=(math.radians(90), 0, 0))

    life_path = os.path.join(IMAGE_DIR, CAVE_17_IMAGES["daily_life"])
    life_mat = create_cave_mural_material(
        "洞窟{}_绢画_市井".format(cave_name), life_path,
        COLOR_ZHESHI, "daily_life", dynasty)
    # 右墙绢画
    add_plane("洞窟{}_右墙_绢画".format(cave_name),
              (x_center, y_max - 0.15, upper_z),
              (2.0, 1.5, 1), life_mat,
              rotation=(math.radians(90), 0, math.radians(180)))

    # 藏经绢画独立展台（核心展品C位）
    base_mat = create_material("展台_做旧土色", (0.40, 0.32, 0.22), roughness=0.85)
    display_mat = create_material("展台_深色", (0.25, 0.20, 0.15), roughness=0.7)

    # 创建多个小展柜用 box 模拟经卷展台
    for i, x_off in enumerate([-1.5, 0, 1.5]):
        # 展台基座
        add_box("展台{}_经卷_{}".format(cave_name, i),
                (x_center + x_off, 0, 0.4),
                (1.0, 0.6, 0.8), base_mat)
        # 经卷（小方块模拟）
        add_box("经卷{}_{}".format(cave_name, i),
                (x_center + x_off, 0, 0.85),
                (0.6, 0.3, 0.1), display_mat)

    # 后墙绢画展示（独立展台上的绢画，使用17窟专属图片）
    mid_z = 1.55
    sutra_path = os.path.join(IMAGE_DIR, CAVE_17_IMAGES["sutra"])
    sutra_mat = create_cave_mural_material(
        "洞窟{}_后墙_绢画展".format(cave_name), sutra_path,
        COLOR_ZHESHI, "sutra", dynasty)
    add_plane("洞窟{}_后墙_绢画展".format(cave_name),
              (x_start + CAVE_DEPTH - 0.2, 0, mid_z),
              (2.5, 1.8, 1), sutra_mat,
              rotation=(math.radians(90), 0, math.radians(-90)))

    # 左墙底部 - 晚唐供养人壁画（使用17窟专属图片，补充壁画数量）
    bottom_z = 0.6
    monk_path = os.path.join(IMAGE_DIR, CAVE_17_IMAGES["celestial_musicians"])
    monk_mat = create_cave_mural_material(
        "洞窟{}_晚唐僧人".format(cave_name), monk_path,
        COLOR_ZHESHI, "donor", dynasty)
    add_plane("洞窟{}_左墙_晚唐僧人".format(cave_name),
              (x_center - 1.5, y_min + 0.15, bottom_z),
              (2.0, 1.0, 1), monk_mat,
              rotation=(math.radians(90), 0, 0))

    # 右墙底部 - 晚唐藻井壁画（使用17窟专属图片，补充壁画数量）
    caisson_path = os.path.join(IMAGE_DIR, CAVE_17_IMAGES["caisson"])
    caisson_bottom_mat = create_cave_mural_material(
        "洞窟{}_右墙_晚唐藻井".format(cave_name), caisson_path,
        COLOR_ZHESHI, "caisson", dynasty)
    add_plane("洞窟{}_右墙_晚唐藻井".format(cave_name),
              (x_center - 1.5, y_max - 0.15, bottom_z),
              (2.0, 1.0, 1), caisson_bottom_mat,
              rotation=(math.radians(90), 0, math.radians(180)))


def create_cave_sculptures_17(cave_name, x_start, x_center, y_center):
    """17窟（晚唐藏经洞）彩塑：晚唐供养人塑像+僧人像+洪辩法师像（层次感布局）"""
    # 佛龛位置（后墙前方）
    niche_x = x_start + CAVE_DEPTH - 1.5

    # 洪辩法师像（藏经洞核心人物，3D立体造像，抬高展台，居中最高，经卷展台风格）
    create_3d_statue("彩塑{}_洪辩法师".format(cave_name),
                     (niche_x, y_center, 0),
                     'disciple', 0.80, COLOR_ZHESHI,
                     base_style='sutra_platform')

    # 两侧弟子塑像（3D立体造像，稍微靠前形成层次，经卷展台风格）
    create_3d_statue("彩塑{}_左弟子".format(cave_name),
                     (niche_x - 0.4, y_center - 1.5, 0),
                     'disciple', BASE_BODHISATTVA, COLOR_ZHESHI,
                     base_style='sutra_platform', disciple_type='kasyapa')
    create_3d_statue("彩塑{}_右弟子".format(cave_name),
                     (niche_x - 0.4, y_center + 1.5, 0),
                     'disciple', BASE_BODHISATTVA, COLOR_ZHESHI,
                     base_style='sutra_platform', disciple_type='ananda')

    # 两侧小型僧人像（3D立体造像，最靠前形成纵深层次，经卷展台风格）
    create_3d_statue("彩塑{}_左僧人".format(cave_name),
                     (niche_x - 0.5, y_center - 2.7, 0),
                     'disciple', BASE_GUARDIAN, COLOR_ZHESHI,
                     base_style='sutra_platform', disciple_type='ananda')
    create_3d_statue("彩塑{}_右僧人".format(cave_name),
                     (niche_x - 0.5, y_center + 2.7, 0),
                     'disciple', BASE_GUARDIAN, COLOR_ZHESHI,
                     base_style='sutra_platform', disciple_type='kasyapa')


def create_cave_murals_3(cave_name, x_start, x_center, y_min, y_max):
    """3窟（元代）壁画：密宗题材壁画（千手观音、密宗护法、密宗千佛）"""
    upper_z = CAVE_HEIGHT * 0.75
    dynasty = "元代"

    # 左墙上层 - 密宗千佛纹（使用3窟专属图片，千佛图象征密宗千佛阵列）
    thousand_path = os.path.join(IMAGE_DIR, CAVE_3_IMAGES["thousand_buddhas"])
    thousand_mat = create_cave_mural_material(
        "洞窟{}_密宗千佛".format(cave_name), thousand_path,
        COLOR_SHILV, "thousand_buddha", dynasty)
    add_plane("洞窟{}_左墙_密宗千佛".format(cave_name),
              (x_center, y_min + 0.15, upper_z),
              (2.5, 1.5, 1), thousand_mat,
              rotation=(math.radians(90), 0, 0))

    # 右墙上层 - 密宗胁侍菩萨（使用3窟专属图片，胁侍菩萨象征密宗眷属）
    attendant_path = os.path.join(IMAGE_DIR, CAVE_3_IMAGES["celestial_musicians"])
    attendant_mat = create_cave_mural_material(
        "洞窟{}_密宗胁侍".format(cave_name), attendant_path,
        COLOR_SHIQING, "flying", dynasty)
    add_plane("洞窟{}_右墙_密宗胁侍".format(cave_name),
              (x_center, y_max - 0.15, upper_z),
              (2.5, 1.5, 1), attendant_mat,
              rotation=(math.radians(90), 0, math.radians(180)))

    # 后墙中部 - 密宗护法天王经变画（使用3窟专属图片，核心展品）
    # 壁画位置在墙体前方，避免嵌入墙体被遮挡
    mid_z = 1.55
    sutra_path = os.path.join(IMAGE_DIR, CAVE_3_IMAGES["sutra"])
    sutra_mat = create_cave_mural_material(
        "洞窟{}_后墙_密宗经变画".format(cave_name), sutra_path,
        COLOR_SHILV, "sutra", dynasty)
    add_plane("洞窟{}_后墙_密宗经变画".format(cave_name),
              (x_start + CAVE_DEPTH - WALL_THICKNESS - 0.05, 0, mid_z),
              (3.0, 2.0, 1), sutra_mat,
              rotation=(math.radians(90), 0, math.radians(-90)))

    # 左墙底部 - 密宗金刚力士供养（使用3窟专属图片，补充壁画数量至4副以上）
    bottom_z = 0.6
    donor_path = os.path.join(IMAGE_DIR, CAVE_3_IMAGES["donors"])
    donor_mat = create_cave_mural_material(
        "洞窟{}_密宗供养".format(cave_name), donor_path,
        COLOR_ZHESHI, "donor", dynasty)
    add_plane("洞窟{}_左墙_密宗供养".format(cave_name),
              (x_center - 1.5, y_min + 0.15, bottom_z),
              (2.0, 1.0, 1), donor_mat,
              rotation=(math.radians(90), 0, 0))

    # 右墙底部 - 密宗主尊千手观音（使用3窟专属图片，补充壁画数量至4副以上）
    apsara_path = os.path.join(IMAGE_DIR, CAVE_3_IMAGES["flying_apsara"])
    apsara_mat = create_cave_mural_material(
        "洞窟{}_密宗主尊".format(cave_name), apsara_path,
        COLOR_SHIQING, "flying", dynasty)
    add_plane("洞窟{}_右墙_密宗主尊".format(cave_name),
              (x_center - 1.5, y_max - 0.15, bottom_z),
              (2.0, 1.0, 1), apsara_mat,
              rotation=(math.radians(90), 0, math.radians(180)))

    # 藻井 - 密宗护法菩萨团花（使用3窟专属图片，增强密宗氛围）
    caisson_path = os.path.join(IMAGE_DIR, CAVE_3_IMAGES["caisson"])
    caisson_mat = create_cave_mural_material(
        "洞窟{}_密宗藻井".format(cave_name), caisson_path,
        COLOR_SHILV, "caisson", dynasty)
    add_plane("洞窟{}_密宗藻井".format(cave_name),
              (x_center, 0, CAVE_HEIGHT - 0.07),
              (3.5, 3.5, 1), caisson_mat)


def create_cave_sculptures_3(cave_name, x_start, x_center, y_center):
    """
    3窟（元代）彩塑：千手千眼观音立体造像（尺寸加大，核心展品，3层纵深布局）
    布局：千手观音居中最高 -> 胁侍菩萨 -> 护法金刚（最外侧）
    """
    # 佛龛位置（后墙前方）
    niche_x = x_start + CAVE_DEPTH - 1.5

    # 千手千眼观音基座高度提升（居中抬高，核心展品）
    guardian_base = 0.90

    # 千手千眼观音（3D立体造像，尺寸加大作为核心展品，居中最高，密宗坛城基座，多臂效果）
    create_3d_statue("彩塑{}_密宗千手观音".format(cave_name),
                     (niche_x, y_center, 0),
                     'bodhisattva', guardian_base, COLOR_SHILV,
                     base_style='mandala', extra_arms=True)

    # 两侧胁侍菩萨（3D立体造像，高低错落：左侧抬高，右侧降低，形成层次，密宗坛城基座）
    create_3d_statue("彩塑{}_密宗左胁侍".format(cave_name),
                     (niche_x - 0.4, y_center - 1.8, 0),
                     'bodhisattva', BASE_BODHISATTVA + 0.10, COLOR_SHIQING,
                     base_style='mandala')
    create_3d_statue("彩塑{}_密宗右胁侍".format(cave_name),
                     (niche_x - 0.4, y_center + 1.8, 0),
                     'bodhisattva', BASE_BODHISATTVA - 0.05, COLOR_SHIQING,
                     base_style='mandala')

    # 两侧护法金刚造像（最外侧，最靠前形成纵深层次，密宗坛城基座）
    create_3d_statue("彩塑{}_密宗左护法金刚".format(cave_name),
                     (niche_x - 0.6, y_center - 2.8, 0),
                     'guardian', BASE_GUARDIAN, COLOR_ZHUSHA,
                     base_style='mandala')
    create_3d_statue("彩塑{}_密宗右护法金刚".format(cave_name),
                     (niche_x - 0.6, y_center + 2.8, 0),
                     'guardian', BASE_GUARDIAN, COLOR_ZHUSHA,
                     base_style='mandala')


def create_cave_area():
    """创建核心复刻洞窟区"""
    print("\n--- 创建核心复刻洞窟区 ---")
    for i, cave_info in enumerate(CAVES):
        create_cave(cave_info, i)
    print("洞窟区完成（5间）")


# ============================================================
# 四、分时代单体展品陈列区
# ============================================================
def create_display_area():
    """创建分时代单体展品陈列区"""
    print("\n--- 创建分时代单体展品陈列区 ---")

    # 陈列区隔墙
    partition_mat = create_material("陈列区隔墙", (0.48, 0.38, 0.25), roughness=0.88)
    add_box("陈列区隔墙", (ZONE_CAVES_END, 0, MUSEUM_HEIGHT / 2),
            (WALL_THICKNESS, MUSEUM_WIDTH, MUSEUM_HEIGHT), partition_mat)
    # 留出通道
    add_box("陈列区通道_上", (ZONE_CAVES_END, 0, MUSEUM_HEIGHT * 0.75),
            (WALL_THICKNESS, MUSEUM_WIDTH, MUSEUM_HEIGHT * 0.5), partition_mat)

    # 四个朝代展区
    dynasty_items = [
        ("北朝", "northern_buddha", ZONE_CAVES_END + 2.0),
        ("隋代", "sui_statue", ZONE_CAVES_END + 5.0),
        ("盛唐", "tang_bodhisattva", ZONE_CAVES_END + 8.0),
        ("晚期", "late_tang_monk", ZONE_CAVES_END + 11.0),
    ]

    base_mat = create_material("展柜基座", (0.35, 0.28, 0.20), roughness=0.85)
    niche_mat = create_material("壁龛_砂岩色", (0.45, 0.36, 0.24), roughness=0.88)

    for dynasty, img_key, x_pos in dynasty_items:
        img_path = os.path.join(IMAGE_DIR, GALLERY_IMAGES[img_key])
        statue_mat = create_image_material("陈列_{}".format(dynasty), img_path)

        # 壁龛（内凹 10 厘米竖向壁龛）
        niche_y = MUSEUM_WIDTH / 2 - 0.3
        add_box("壁龛_{}".format(dynasty), (x_pos, niche_y - 0.15, 1.5),
                (1.5, 0.3, 3.0), niche_mat)

        # 基座
        base_height = BASE_BODHISATTVA
        add_box("基座_{}".format(dynasty), (x_pos, niche_y - 0.4, base_height / 2),
                (0.6, 0.6, base_height), base_mat)

        # 彩塑（图片平面）
        add_plane("彩塑_{}".format(dynasty),
                  (x_pos, niche_y - 0.45, base_height + 0.9),
                  (1.0, 1.6, 1), statue_mat,
                  rotation=(math.radians(90), 0, math.radians(-90)))

        # 对称展品（另一侧）
        niche_y2 = -MUSEUM_WIDTH / 2 + 0.3
        add_box("壁龛2_{}".format(dynasty), (x_pos, niche_y2 + 0.15, 1.5),
                (1.5, 0.3, 3.0), niche_mat)
        add_box("基座2_{}".format(dynasty), (x_pos, niche_y2 + 0.4, base_height / 2),
                (0.6, 0.6, base_height), base_mat)
        add_plane("彩塑2_{}".format(dynasty),
                  (x_pos, niche_y2 + 0.45, base_height + 0.9),
                  (1.0, 1.6, 1), statue_mat,
                  rotation=(math.radians(90), 0, math.radians(90)))

    # 陈列区前墙壁画背景（使用千佛图图片纹理，避免空白白色墙面）
    thousand_path = os.path.join(IMAGE_DIR, GALLERY_IMAGES["thousand_buddhas"])
    wall_mural_mat = create_image_material("陈列区_前墙壁画", thousand_path, roughness=0.85)
    add_plane("陈列区_前墙壁画",
              ((ZONE_CAVES_END + ZONE_DISPLAY_END) / 2, -MUSEUM_WIDTH / 2 + 0.15, 2.5),
              (8.0, 3.0, 1), wall_mural_mat,
              rotation=(math.radians(90), 0, math.radians(180)))

    # 陈列区后墙壁画背景（使用飞天图片纹理，避免空白白色墙面）
    apsara_path = os.path.join(IMAGE_DIR, GALLERY_IMAGES["flying_apsara"])
    wall_mural_mat2 = create_image_material("陈列区_后墙壁画", apsara_path, roughness=0.85)
    add_plane("陈列区_后墙壁画",
              ((ZONE_CAVES_END + ZONE_DISPLAY_END) / 2, MUSEUM_WIDTH / 2 - 0.15, 2.5),
              (8.0, 3.0, 1), wall_mural_mat2,
              rotation=(math.radians(90), 0, 0))

    print("陈列区完成（4个朝代展区）")


# ============================================================
# 五、数字互动收尾区
# ============================================================
def create_digital_area():
    """创建数字互动收尾区"""
    print("\n--- 创建数字互动收尾区 ---")

    # 隔墙
    partition_mat = create_material("数字区隔墙", (0.48, 0.38, 0.25), roughness=0.88)
    add_box("数字区隔墙_上", (ZONE_DISPLAY_END, 0, MUSEUM_HEIGHT * 0.75),
            (WALL_THICKNESS, MUSEUM_WIDTH, MUSEUM_HEIGHT * 0.5), partition_mat)
    add_box("数字区隔墙_左", (ZONE_DISPLAY_END, -MUSEUM_WIDTH / 2 + 2.0, MUSEUM_HEIGHT * 0.25),
            (WALL_THICKNESS, MUSEUM_WIDTH - 4.0, MUSEUM_HEIGHT * 0.5), partition_mat)
    add_box("数字区隔墙_右", (ZONE_DISPLAY_END, MUSEUM_WIDTH / 2 - 2.0, MUSEUM_HEIGHT * 0.25),
            (WALL_THICKNESS, MUSEUM_WIDTH - 4.0, MUSEUM_HEIGHT * 0.5), partition_mat)

    # VR 设备台
    device_mat = create_material("数字设备台", (0.20, 0.18, 0.15), roughness=0.7)
    for i, x in enumerate([ZONE_DISPLAY_END + 2.0, ZONE_DISPLAY_END + 5.0, ZONE_DISPLAY_END + 8.0]):
        add_box("VR设备台_{}".format(i), (x, -2.0, 0.5),
                (1.5, 1.0, 1.0), device_mat)
        add_box("VR设备屏_{}".format(i), (x, -2.0, 1.6),
                (1.2, 0.05, 0.8), device_mat)

    # AR 操作台
    for i, x in enumerate([ZONE_DISPLAY_END + 2.0, ZONE_DISPLAY_END + 5.0, ZONE_DISPLAY_END + 8.0]):
        add_box("AR操作台_{}".format(i), (x, 2.0, 0.5),
                (1.5, 1.0, 1.0), device_mat)
        add_box("AR操作屏_{}".format(i), (x, 2.0, 1.6),
                (1.2, 0.05, 0.8), device_mat)

    # 文创区展柜
    display_cabinet_mat = create_material("文创展柜", (0.25, 0.22, 0.18), roughness=0.8)
    for i in range(3):
        x = ZONE_DISPLAY_END + 11.0 + i * 1.5
        add_box("文创展柜_{}".format(i), (x, 0, 0.6),
                (0.8, 0.5, 1.2), display_cabinet_mat)

    print("数字互动区完成")


# ============================================================
# 六、灯光系统
# ============================================================
def create_lighting():
    """创建全馆灯光系统（3000K 暖黄光）"""
    print("\n--- 创建灯光系统 ---")

    warm_color = (1.0, 0.88, 0.72)  # 3000K 暖黄光

    # 序厅灯光（照度≤50lux，漫射暖柔光）
    bpy.ops.object.light_add(type='AREA', location=(4.0, 0, MUSEUM_HEIGHT - 0.2))
    light = bpy.context.active_object
    light.name = "序厅_主光"
    light.data.energy = 150
    light.data.size = 6.0
    light.data.color = warm_color

    # 洞窟区灯光（基础照度≤100lux，重点补光120lux）
    for i, cave_info in enumerate(CAVES):
        x_center = cave_info["x_start"] + CAVE_DEPTH / 2

        # 洞窟顶部柔光（藻井顶光）
        bpy.ops.object.light_add(type='AREA', location=(x_center, 0, CAVE_HEIGHT - 0.15))
        light = bpy.context.active_object
        light.name = "洞窟{}_顶光".format(cave_info["name"])
        light.data.energy = 80
        light.data.size = 3.0
        light.data.color = warm_color

        # 经变画重点补光（120lux）
        bpy.ops.object.light_add(type='SPOT',
                                  location=(x_center, 0, CAVE_HEIGHT - 0.5))
        light = bpy.context.active_object
        light.name = "洞窟{}_经变画补光".format(cave_info["name"])
        light.data.energy = 60
        light.data.spot_size = math.radians(45)
        light.data.spot_blend = 0.7
        light.data.color = warm_color
        light.rotation_euler = (math.radians(70), 0, 0)

        # 彩塑双侧 45 度侧柔光
        niche_x = cave_info["x_start"] + CAVE_DEPTH - 1.5
        for angle_y, offset in [(45, -1.5), (-45, 1.5)]:
            bpy.ops.object.light_add(type='SPOT',
                                      location=(niche_x + 1.0, offset, 2.5))
            light = bpy.context.active_object
            light.name = "洞窟{}_彩塑光_{}".format(cave_info["name"], offset)
            light.data.energy = 40
            light.data.spot_size = math.radians(50)
            light.data.spot_blend = 0.6
            light.data.color = warm_color
            light.rotation_euler = (math.radians(90), 0, math.radians(angle_y))

    # 核心镇馆文物重点射灯（45窟主佛、3窟千手观音）
    # 45窟盛唐主佛重点射灯（energy=100）
    niche_x_45 = 15.0 + CAVE_DEPTH - 1.5
    bpy.ops.object.light_add(type='SPOT',
                              location=(niche_x_45 + 1.0, 0, 3.0))
    light = bpy.context.active_object
    light.name = "45窟_主佛重点射灯"
    light.data.energy = 100
    light.data.spot_size = math.radians(40)
    light.data.spot_blend = 0.5
    light.data.color = warm_color
    light.rotation_euler = (math.radians(90), 0, math.radians(45))

    # 3窟千手观音重点射灯（energy=100）
    niche_x_3 = 36.0 + CAVE_DEPTH - 1.5
    bpy.ops.object.light_add(type='SPOT',
                              location=(niche_x_3 + 1.0, 0, 3.2))
    light = bpy.context.active_object
    light.name = "3窟_千手观音重点射灯"
    light.data.energy = 100
    light.data.spot_size = math.radians(40)
    light.data.spot_blend = 0.5
    light.data.color = warm_color
    light.rotation_euler = (math.radians(90), 0, math.radians(45))

    # 陈列区灯光
    for x in [ZONE_CAVES_END + 2.0, ZONE_CAVES_END + 5.0, ZONE_CAVES_END + 8.0, ZONE_CAVES_END + 11.0]:
        bpy.ops.object.light_add(type='AREA', location=(x, 0, MUSEUM_HEIGHT - 0.2))
        light = bpy.context.active_object
        light.name = "陈列区光_{:.0f}".format(x)
        light.data.energy = 100
        light.data.size = 3.0
        light.data.color = warm_color

        # 展品单侧柔光轨道
        bpy.ops.object.light_add(type='SPOT', location=(x, 0, MUSEUM_HEIGHT - 0.5))
        light = bpy.context.active_object
        light.name = "陈列区_展品光_{:.0f}".format(x)
        light.data.energy = 50
        light.data.spot_size = math.radians(40)
        light.data.spot_blend = 0.6
        light.data.color = warm_color
        light.rotation_euler = (math.radians(70), 0, 0)

    # 数字区灯光
    bpy.ops.object.light_add(type='AREA', location=(ZONE_DISPLAY_END + 5.0, 0, MUSEUM_HEIGHT - 0.2))
    light = bpy.context.active_object
    light.name = "数字区_主光"
    light.data.energy = 120
    light.data.size = 5.0
    light.data.color = warm_color

    print("灯光系统完成（3000K 暖黄光）")


# ============================================================
# 七、相机
# ============================================================
def create_cameras():
    """创建多个相机视角"""
    print("\n--- 创建相机 ---")

    # 主相机 - 入口视角
    bpy.ops.object.camera_add(location=(1.0, 0, 1.6))
    cam = bpy.context.active_object
    cam.name = "主相机_入口"
    cam.rotation_euler = (math.radians(85), 0, math.radians(-90))
    cam.data.lens = 18
    bpy.context.scene.camera = cam

    # 洞窟区相机
    bpy.ops.object.camera_add(location=(20.0, 0, 1.6))
    cam = bpy.context.active_object
    cam.name = "相机_洞窟区"
    cam.rotation_euler = (math.radians(85), 0, math.radians(-90))
    cam.data.lens = 24

    # 洞窟内部相机（45窟）
    bpy.ops.object.camera_add(location=(18.0, 0, 1.6))
    cam = bpy.context.active_object
    cam.name = "相机_45窟内部"
    cam.rotation_euler = (math.radians(85), 0, math.radians(90))
    cam.data.lens = 16

    # 陈列区相机
    bpy.ops.object.camera_add(location=(45.0, 0, 1.6))
    cam = bpy.context.active_object
    cam.name = "相机_陈列区"
    cam.rotation_euler = (math.radians(85), 0, math.radians(-90))
    cam.data.lens = 24

    # 俯瞰相机
    bpy.ops.object.camera_add(location=(32.0, 0, MUSEUM_HEIGHT - 0.5))
    cam = bpy.context.active_object
    cam.name = "相机_俯瞰"
    cam.rotation_euler = (0, 0, 0)
    cam.data.lens = 16

    print("相机创建完成（5个视角）")


# ============================================================
# 八、渲染设置
# ============================================================
def setup_render():
    """设置渲染参数"""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 64
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100

    # 世界背景
    world = scene.world
    if world is None:
        world = bpy.data.worlds.new("世界")
        scene.world = world
    world.use_nodes = True
    bg_node = world.node_tree.nodes.get("Background")
    if bg_node:
        bg_node.inputs["Color"].default_value = (0.02, 0.02, 0.02, 1.0)
        bg_node.inputs["Strength"].default_value = 0.3
    print("渲染参数已设置")


# ============================================================
# 九、墙面壁画肌理暗纹
# ============================================================
def create_wall_mural_textures():
    """墙面添加淡敦煌壁画肌理暗纹（用图片纹理叠加矿物底色）"""
    print("\n--- 创建墙面壁画肌理暗纹 ---")

    # 千佛纹暗纹材质（叠加在土黄底色上，使用走廊专属图片不与洞窟重复）
    thousand_path = os.path.join(IMAGE_DIR, CORRIDOR_IMAGES["thousand_buddhas"])
    if os.path.exists(thousand_path):
        faint_mat = create_faint_mural_material(
            "墙面_千佛暗纹", thousand_path,
            base_color=COLOR_TUHUANG, intensity=0.30, roughness=0.92)
    else:
        # 走廊专属图片不存在时使用程序化纹理
        print("  走廊千佛暗纹图片不存在，使用程序化纹理")
        faint_mat = create_procedural_mural(
            "墙面_千佛暗纹", COLOR_TUHUANG, "thousand_buddha", "盛唐")

    # 洞窟区前墙暗纹（多段布置）
    for cave_info in CAVES:
        x_start = cave_info["x_start"]
        x_center = x_start + CAVE_DEPTH / 2
        cave_name = cave_info["name"]

        # 前墙暗纹（门洞上方）
        add_plane("暗纹_{}_前墙".format(cave_name),
                  (x_start + WALL_THICKNESS / 2 - 0.02, 0, CAVE_HEIGHT * 0.65),
                  (1.4, 5.0, 1), faint_mat,
                  rotation=(0, math.radians(-90), 0))

        # 后墙暗纹
        add_plane("暗纹_{}_后墙".format(cave_name),
                  (x_start + CAVE_DEPTH - WALL_THICKNESS / 2 + 0.02, 0, CAVE_HEIGHT * 0.65),
                  (1.4, 5.0, 1), faint_mat,
                  rotation=(0, math.radians(90), 0))

    # 序厅墙面暗纹（石青底色+飞天暗纹，使用走廊专属图片不与洞窟重复）
    apsara_path = os.path.join(IMAGE_DIR, CORRIDOR_IMAGES["flying_apsara"])
    if os.path.exists(apsara_path):
        entrance_faint = create_faint_mural_material(
            "序厅_飞天暗纹", apsara_path,
            base_color=COLOR_SHIQING, intensity=0.25, roughness=0.92)
    else:
        # 走廊专属图片不存在时使用程序化纹理
        print("  序厅飞天暗纹图片不存在，使用程序化纹理")
        entrance_faint = create_procedural_mural(
            "序厅_飞天暗纹", COLOR_SHIQING, "flying", "西魏")
    add_plane("暗纹_序厅_前墙", (5.0, -MUSEUM_WIDTH / 2 + 0.12, 2.5),
              (2.0, 4.0, 1), entrance_faint,
              rotation=(math.radians(90), 0, math.radians(180)))
    add_plane("暗纹_序厅_后墙", (5.0, MUSEUM_WIDTH / 2 - 0.12, 2.5),
              (2.0, 4.0, 1), entrance_faint,
              rotation=(math.radians(90), 0, 0))

    print("墙面壁画肌理暗纹完成")


# ============================================================
# 十、洞窟外部戈壁砂岩崖壁造型
# ============================================================
def create_cliff_facade():
    """创建洞窟外部写实戈壁砂岩崖壁造型（凹凸不平几何体+风沙岩刻细节）"""
    print("\n--- 创建戈壁砂岩崖壁造型 ---")

    # 崖壁材质（土黄+赭石混合砂岩色）
    cliff_mat = create_material("崖壁_砂岩", COLOR_TUHUANG, roughness=0.95)
    cliff_dark_mat = create_material("崖壁_深砂岩", COLOR_ZHESHI, roughness=0.95)

    door_width = 2.0
    door_height = 2.5

    for cave_info in CAVES:
        cave_name = cave_info["name"]
        x_start = cave_info["x_start"]
        x_front = x_start + WALL_THICKNESS / 2 - 0.05

        print("  创建崖壁: {}窟".format(cave_name))

        # 门洞上方崖壁段（凹凸不平）
        top_w = CAVE_WIDTH
        top_h = CAVE_HEIGHT - door_height
        top_z = door_height + top_h / 2
        create_bumpy_wall("崖壁_{}_上方".format(cave_name),
                          (x_front, 0, top_z),
                          (top_h, top_w, 1), cliff_mat,
                          rotation=(0, math.radians(-90), 0),
                          bumpiness=0.25, subdivisions=5)

        # 门洞左侧崖壁段
        side_w = (CAVE_WIDTH - door_width) / 2
        left_y = -CAVE_WIDTH / 2 + side_w / 2
        create_bumpy_wall("崖壁_{}_左侧".format(cave_name),
                          (x_front, left_y, door_height / 2),
                          (door_height, side_w, 1), cliff_mat,
                          rotation=(0, math.radians(-90), 0),
                          bumpiness=0.20, subdivisions=4)

        # 门洞右侧崖壁段
        right_y = CAVE_WIDTH / 2 - side_w / 2
        create_bumpy_wall("崖壁_{}_右侧".format(cave_name),
                          (x_front, right_y, door_height / 2),
                          (door_height, side_w, 1), cliff_dark_mat,
                          rotation=(0, math.radians(-90), 0),
                          bumpiness=0.20, subdivisions=4)

        # 风沙侵蚀水平沟槽（细长方块模拟风蚀纹）
        groove_mat = create_material("风蚀纹_{}".format(cave_name),
                                     COLOR_ZHESHI, roughness=0.98)
        rng = random.Random(int(cave_name))
        for g in range(3):
            gz = 0.8 + g * 0.6 + rng.uniform(-0.1, 0.1)
            gx_offset = rng.uniform(-0.3, 0.3)
            add_box("风蚀纹_{}_{}".format(cave_name, g),
                    (x_front - 0.15 - abs(gx_offset), 0, gz),
                    (0.08, CAVE_WIDTH * 0.9, 0.04), groove_mat)

        # 岩刻装饰纹（石青色小方块模拟石刻）
        carving_mat = create_material("岩刻_{}".format(cave_name),
                                     COLOR_SHIQING, roughness=0.85)
        for c in range(2):
            cy = -1.5 + c * 3.0
            add_box("岩刻_{}_{}".format(cave_name, c),
                    (x_front - 0.12, cy, 1.0),
                    (0.06, 0.4, 0.4), carving_mat)

    print("戈壁砂岩崖壁造型完成")


# ============================================================
# 十一、洞窟编号标签
# ============================================================
def create_cave_number_labels():
    """洞窟编号标签已删除 - 不再显示洞窟名称"""
    print("\n--- 洞窟编号标签已跳过（已删除）---")


# ============================================================
# 十二、石窟栈道与阶梯
# ============================================================
def create_walkways_and_stairs():
    """洞窟外部崖壁增设石窟栈道（木板通道）和阶梯"""
    print("\n--- 创建石窟栈道与阶梯 ---")

    # 栈道材质（赭石色木板）
    plank_mat = create_material("栈道_木板", COLOR_ZHESHI, roughness=0.80)
    # 阶梯材质（土黄色石材）
    stair_mat = create_material("阶梯_石材", COLOR_TUHUANG, roughness=0.85)
    # 栈道扶手材质（石青色）
    rail_mat = create_material("栈道_扶手", COLOR_SHIQING, roughness=0.75)

    for cave_info in CAVES:
        cave_name = cave_info["name"]
        x_start = cave_info["x_start"]

        print("  创建栈道: {}窟".format(cave_name))

        # 栈道木板（洞窟门前水平通道）
        add_box("栈道_{}_板".format(cave_name),
                (x_start - 0.5, 0, 0.05),
                (0.8, CAVE_WIDTH + 0.5, 0.1), plank_mat)

        # 栈道扶手立柱
        for ry in [-CAVE_WIDTH / 2 - 0.2, CAVE_WIDTH / 2 + 0.2]:
            add_box("栈道_{}_柱_{}".format(cave_name, ry),
                    (x_start - 0.5, ry, 0.55),
                    (0.08, 0.08, 1.0), rail_mat)

        # 栈道扶手横杆
        add_box("栈道_{}_扶手".format(cave_name),
                (x_start - 0.5, -CAVE_WIDTH / 2 - 0.2, 1.0),
                (0.06, CAVE_WIDTH + 0.4, 0.06), rail_mat)
        add_box("栈道_{}_扶手2".format(cave_name),
                (x_start - 0.5, CAVE_WIDTH / 2 + 0.2, 1.0),
                (0.06, CAVE_WIDTH + 0.4, 0.06), rail_mat)

        # 阶梯（3级台阶）
        for s in range(3):
            step_h = 0.12
            step_d = 0.25
            add_box("阶梯_{}_{}".format(cave_name, s),
                    (x_start - 0.9 - s * step_d, 0, step_h * (s + 1) / 2),
                    (step_d, CAVE_WIDTH + 0.5, step_h), stair_mat)

    print("石窟栈道与阶梯完成")


# ============================================================
# 十三、廊道仿古灯龛与文物立牌
# ============================================================
def create_corridor_decorations():
    """廊道添加仿古灯龛、文物立牌"""
    print("\n--- 创建廊道灯龛与文物立牌 ---")

    # 灯龛发光材质（暖黄光）
    lamp_mat = create_emissive_material("灯龛_光", (1.0, 0.82, 0.50), strength=3.0)
    # 灯龛外壳材质（赭石色）
    lamp_shell_mat = create_material("灯龛_壳", COLOR_ZHESHI, roughness=0.70)
    # 立牌材质（石绿底色）
    sign_mat = create_material("立牌_板", COLOR_SHILV, roughness=0.80)

    for cave_info in CAVES:
        cave_name = cave_info["name"]
        dynasty = cave_info["dynasty"]
        x_start = cave_info["x_start"]
        x_front = x_start + WALL_THICKNESS / 2

        print("  创建灯龛/立牌: {}窟".format(cave_name))

        # 仿古灯龛（门洞两侧壁挂式）
        for ly in [-1.8, 1.8]:
            # 灯龛外壳
            add_box("灯龛_{}_{}".format(cave_name, ly),
                    (x_front - 0.05, ly, 1.8),
                    (0.12, 0.25, 0.35), lamp_shell_mat)
            # 灯龛发光体
            add_box("灯龛光_{}_{}".format(cave_name, ly),
                    (x_front - 0.08, ly, 1.8),
                    (0.06, 0.15, 0.25), lamp_mat)

        # 文物立牌（已删除文字部分，仅保留立牌支柱和面板）
        sign_text = "{}{}窟".format(dynasty, cave_name)
        sign_x = x_start - 1.5
        # 立牌支柱
        add_box("立牌柱_{}".format(cave_name),
                (sign_x, -CAVE_WIDTH / 2 - 0.6, 0.6),
                (0.06, 0.06, 1.2), lamp_shell_mat)
        # 立牌面板（法线朝 -Y 面向走廊游客）
        add_plane("立牌板_{}".format(cave_name),
                  (sign_x, -CAVE_WIDTH / 2 - 0.55, 1.2),
                  (0.5, 0.7, 1), sign_mat,
                  rotation=(math.radians(90), 0, 0))

    print("廊道灯龛与文物立牌完成")


# ============================================================
# 十四、洞窟内部完整复刻
# ============================================================
def create_cave_interior_details():
    """洞窟内部完整复刻：覆斗形窟顶、四壁佛龛、藻井天花"""
    print("\n--- 完善洞窟内部细节 ---")

    for cave_info in CAVES:
        cave_name = cave_info["name"]
        x_start = cave_info["x_start"]
        x_center = x_start + CAVE_DEPTH / 2
        y_min = -CAVE_WIDTH / 2
        y_max = CAVE_WIDTH / 2

        print("  完善洞窟内部: {}窟".format(cave_name))

        # --- 四壁佛龛（左墙、右墙、前墙增设小型佛龛）---
        niche_mat = create_material("佛龛_{}".format(cave_name),
                                    COLOR_ZHESHI, roughness=0.85)
        niche_frame_mat = create_material("佛龛框_{}".format(cave_name),
                                          COLOR_SHIQING, roughness=0.75)

        # 左墙佛龛（内凹式壁龛，用方块框架模拟）
        niche_ly = y_min + WALL_THICKNESS + 0.1
        add_box("佛龛_{}_左".format(cave_name),
                (x_center, niche_ly, 1.5),
                (1.2, 0.15, 2.0), niche_mat)
        add_box("佛龛框_{}_左上".format(cave_name),
                (x_center, niche_ly - 0.02, 2.5),
                (1.3, 0.06, 0.06), niche_frame_mat)
        add_box("佛龛框_{}_左下".format(cave_name),
                (x_center, niche_ly - 0.02, 0.5),
                (1.3, 0.06, 0.06), niche_frame_mat)

        # 右墙佛龛
        niche_ry = y_max - WALL_THICKNESS - 0.1
        add_box("佛龛_{}_右".format(cave_name),
                (x_center, niche_ry, 1.5),
                (1.2, 0.15, 2.0), niche_mat)
        add_box("佛龛框_{}_右上".format(cave_name),
                (x_center, niche_ry + 0.02, 2.5),
                (1.3, 0.06, 0.06), niche_frame_mat)
        add_box("佛龛框_{}_右下".format(cave_name),
                (x_center, niche_ry + 0.02, 0.5),
                (1.3, 0.06, 0.06), niche_frame_mat)

        # 前墙佛龛（门洞上方）
        niche_fx = x_start + WALL_THICKNESS + 0.1
        add_box("佛龛_{}_前".format(cave_name),
                (niche_fx, 0, 3.2),
                (0.15, 2.0, 1.0), niche_mat)
        add_box("佛龛框_{}_前左".format(cave_name),
                (niche_fx + 0.02, -1.0, 3.2),
                (0.06, 0.06, 1.1), niche_frame_mat)
        add_box("佛龛框_{}_前右".format(cave_name),
                (niche_fx + 0.02, 1.0, 3.2),
                (0.06, 0.06, 1.1), niche_frame_mat)

        # --- 藻井天花（多层同心方框，矿物色彩）---
        caisson_layers = [
            (2.8, COLOR_SHIQING, "石青"),
            (2.2, COLOR_SHILV, "石绿"),
            (1.6, COLOR_ZHUSHA, "朱砂"),
            (1.0, COLOR_TUHUANG, "土黄"),
        ]
        for layer_size, layer_color, color_name in caisson_layers:
            layer_mat = create_material(
                "藻井_{}_{}".format(cave_name, color_name),
                layer_color, roughness=0.5)
            add_box("藻井层_{}_{}".format(cave_name, color_name),
                    (x_center, 0, CAVE_HEIGHT - 0.03),
                    (layer_size, layer_size, 0.04), layer_mat)

        # 藻井中心装饰（朱砂色圆盘模拟莲花心）
        center_mat = create_material("藻井心_{}".format(cave_name),
                                    COLOR_ZHUSHA, roughness=0.4)
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.3, depth=0.06,
            location=(x_center, 0, CAVE_HEIGHT - 0.02))
        center_obj = bpy.context.active_object
        center_obj.name = "藻井心_{}".format(cave_name)
        center_obj.data.materials.append(center_mat)

        # --- 覆斗形窟顶加强（四角斜面加强）---
        slope_mat = create_material("覆斗加强_{}".format(cave_name),
                                    COLOR_ZHESHI, roughness=0.88)
        corner_size = 0.6
        for cx, cy in [(x_center - 2.5, y_min + 1.5),
                       (x_center + 2.5, y_min + 1.5),
                       (x_center - 2.5, y_max - 1.5),
                       (x_center + 2.5, y_max - 1.5)]:
            add_box("覆斗角_{}_{}_{}".format(cave_name, cx, cy),
                    (cx, cy, CAVE_HEIGHT - 0.3),
                    (corner_size, corner_size, 0.3), slope_mat)

    print("洞窟内部细节完善完成")


# ============================================================
# 十四、敦煌崖阁式建筑外观升级（河西戈壁丝路建筑基底）
# 五座错落覆斗四坡采光顶 + 虚实交替立面 + 内凹崖壁入口
# ============================================================

# 敦煌崖阁专用色彩（低饱和矿物色系，带沙土肌理）
COLOR_YUANMU = (0.22, 0.14, 0.08)       # 原木深褐 #382414
COLOR_HANGTU = (0.62, 0.52, 0.38)       # 夯土土黄 #9E8561
COLOR_SHAMO = (0.78, 0.70, 0.55)        # 沙漠米白 #C7B28C
COLOR_MUHE = (0.30, 0.20, 0.12)         # 墨褐木色 #4D331F
COLOR_YINBAI = (0.82, 0.78, 0.70)       # 银白砂岩 #D1C7B3
COLOR_TANHEI = (0.15, 0.12, 0.10)       # 炭黑 #26201A
COLOR_RENGUANG = (0.88, 0.82, 0.68)     # 暖赭石光 #E0D1AE
COLOR_DANSHIQING = (0.40, 0.52, 0.55)   # 淡石青 #66858C
COLOR_ZHESHI_QIAN = (0.65, 0.50, 0.35)  # 浅赭石 #A68059
# 新增：浅米色夯土留白屋面专用色（大面积主次分明）
COLOR_QIANMI_HANGTU = (0.83, 0.76, 0.62)  # 浅米色夯土 #D4C29E
# 新增：粗粝赭石砂岩窟顶专用色（哑光质感）
COLOR_ZHESHI_KUDING = (0.58, 0.44, 0.30)  # 粗粝赭石 #94704D
# 新增：淡石绿点缀色（格栅纹样）
COLOR_DANSHILV = (0.42, 0.55, 0.45)      # 淡石绿 #6B8C73


def create_chinese_architecture_facade():
    """
    敦煌崖阁式建筑外观：横向长条崖阁木构长廊主体
    五座错落覆斗四坡采光顶（前后错落+忍冬纹边缘）+ 虚实交替立面（莲花飞天纹漏窗）
    + 内凹崖壁洞窟式主大门（建筑底端）+ 两侧延伸副廊（半开放休憩过渡廊）
    低矮扁平横向舒展，无西式穹顶、罗马柱、欧式装饰
    整体以莫高窟崖阁石窟美学为核心，仅借用园林虚实造景、美术馆展陈逻辑
    """
    print("\n--- 创建敦煌崖阁式建筑外观升级 ---")

    create_base_cliff_facade()
    create_five_pyramid_skylights()
    create_alternating_facade()
    create_recessed_cave_entrances()
    create_side_corridors()
    create_wooden_corridor_system()
    create_desert_landscape()

    print("敦煌崖阁式建筑外观升级完成")


def create_base_cliff_facade():
    """
    基底崖阁立面：浅米黄夯土墙面 + 深褐原木檐廊
    低矮扁平横向舒展，贴合大漠地平线
    新增：大面积浅米色夯土留白屋面（主次视觉分明）
    """
    print("  创建基底崖阁立面")

    hangtu_mat = create_material("夯土墙面_浅米黄", COLOR_HANGTU, roughness=0.95)
    yuanmu_mat = create_material("原木深褐", COLOR_YUANMU, roughness=0.75)
    # 浅米色夯土留白屋面材质（大面积主次分明）
    qianmi_roof_mat = create_material("屋面_浅米色夯土留白", COLOR_QIANMI_HANGTU, roughness=0.96)

    # 前墙夯土（带沙土肌理）
    create_bumpy_wall("崖阁_前墙夯土",
                      (MUSEUM_LENGTH / 2, -MUSEUM_WIDTH / 2 - 0.15, MUSEUM_HEIGHT / 2),
                      (MUSEUM_HEIGHT, MUSEUM_LENGTH, 0.3),
                      hangtu_mat,
                      bumpiness=0.25, subdivisions=8)

    # 后墙夯土
    create_bumpy_wall("崖阁_后墙夯土",
                      (MUSEUM_LENGTH / 2, MUSEUM_WIDTH / 2 + 0.15, MUSEUM_HEIGHT / 2),
                      (MUSEUM_HEIGHT, MUSEUM_LENGTH, 0.3),
                      hangtu_mat,
                      bumpiness=0.25, subdivisions=8)

    # 上下两层原木檐廊横梁
    for layer_z in [0.5, MUSEUM_HEIGHT - 0.6]:
        add_box("崖阁_前檐木_{}".format(int(layer_z)),
                (MUSEUM_LENGTH / 2, -MUSEUM_WIDTH / 2 - 0.35, layer_z),
                (MUSEUM_LENGTH, 0.25, 0.15), yuanmu_mat)
        add_box("崖阁_后檐木_{}".format(int(layer_z)),
                (MUSEUM_LENGTH / 2, MUSEUM_WIDTH / 2 + 0.35, layer_z),
                (MUSEUM_LENGTH, 0.25, 0.15), yuanmu_mat)

    # 大面积浅米色夯土留白屋面（主次视觉分明的核心）
    # 主屋面：覆盖整个建筑顶部，浅米色夯土质感
    add_box("崖阁_主屋面_浅米色夯土",
            (MUSEUM_LENGTH / 2, 0, MUSEUM_HEIGHT + 0.05),
            (MUSEUM_LENGTH, MUSEUM_WIDTH + 0.4, 0.15), qianmi_roof_mat)
    # 屋面斑驳肌理层（自然风化痕迹，分段添加深浅交替）
    for seg_x in range(0, int(MUSEUM_LENGTH), 8):
        seg_center = seg_x + 4
        if seg_center > MUSEUM_LENGTH:
            break
        # 屋面斑驳色块（深浅交替，模拟自然风化）
        bumpy_color = (0.80, 0.73, 0.58) if seg_x % 16 == 0 else (0.85, 0.78, 0.64)
        bumpy_mat = create_material("屋面斑驳_{}".format(seg_x), bumpy_color, roughness=0.97)
        add_box("屋面_斑驳块_{}".format(seg_x),
                (seg_center, 0, MUSEUM_HEIGHT + 0.13),
                (7.8, MUSEUM_WIDTH - 0.5, 0.04), bumpy_mat)

    # 窟顶边缘原木压边
    add_box("崖阁_顶压边_前",
            (MUSEUM_LENGTH / 2, -MUSEUM_WIDTH / 2 - 0.1, MUSEUM_HEIGHT + 0.25),
            (MUSEUM_LENGTH, 0.2, 0.12), yuanmu_mat)
    add_box("崖阁_顶压边_后",
            (MUSEUM_LENGTH / 2, MUSEUM_WIDTH / 2 + 0.1, MUSEUM_HEIGHT + 0.25),
            (MUSEUM_LENGTH, 0.2, 0.12), yuanmu_mat)

    print("  基底崖阁立面完成")


def create_five_pyramid_skylights():
    """
    五座错落覆斗四坡采光顶：分别对应5个洞窟展厅
    大小不一、高度错落，赭石砂岩窟顶区分各朝代区块
    新增：前后错落排布（打破均等直线呆板感）、边缘浅刻忍冬纹样
    大顶对应盛唐45窟、217窟；中小型顶对应西魏285窟、晚唐17窟、元代3窟
    """
    print("  创建五座错落覆斗四坡采光顶")

    # 五座采光顶参数（大小区分明显，前后轻微错落排布）
    # 大顶：盛唐45窟、217窟；中小型顶：西魏285窟、晚唐17窟、元代3窟
    # y_offset：前后错落排布，打破均等直线呆板感
    skylights = [
        {"cave": "285", "dynasty": "西魏", "x": 12.0, "y_offset": -0.5, "size": 3.8, "height": 1.6},  # 中小，后错
        {"cave": "45",  "dynasty": "盛唐", "x": 19.0, "y_offset": 0.6,  "size": 6.0, "height": 2.8},  # 大顶，前错
        {"cave": "217", "dynasty": "盛唐", "x": 26.0, "y_offset": -0.6, "size": 6.5, "height": 3.0},  # 大顶，后错
        {"cave": "17",  "dynasty": "晚唐", "x": 33.0, "y_offset": 0.5,  "size": 4.0, "height": 1.8},  # 中小，前错
        {"cave": "3",   "dynasty": "元代", "x": 40.0, "y_offset": -0.4, "size": 4.5, "height": 2.0},  # 中小，后错
    ]

    yuanmu_mat = create_material("覆斗_原木框", COLOR_YUANMU, roughness=0.75)
    light_mat = create_emissive_material("覆斗_漫射光",
                                          (1.0, 0.93, 0.78), strength=1.2)
    # 忍冬纹边缘浅刻材质（淡石青点缀，低饱和敦煌矿物色系）
    rengong_mat = create_material("覆斗_忍冬纹边缘", COLOR_DANSHIQING, roughness=0.65)

    for sl in skylights:
        cave = sl["cave"]
        dynasty = sl["dynasty"]
        cx = sl["x"]
        cy = sl["y_offset"]  # 前后错落排布
        size = sl["size"]
        h = sl["height"]
        half = size / 2

        # 粗粝赭石砂岩窟顶材质（每个朝代略有色差，哑光质感）
        if dynasty == "西魏":
            roof_color = (0.60, 0.48, 0.33)  # 偏黄赭石
        elif dynasty == "盛唐":
            roof_color = (0.55, 0.42, 0.28)  # 标准赭石
        elif dynasty == "晚唐":
            roof_color = (0.50, 0.40, 0.30)  # 偏深赭石
        else:  # 元代
            roof_color = (0.58, 0.45, 0.30)  # 中等赭石

        roof_mat = create_material("覆斗顶_{}_{}".format(cave, dynasty),
                                    roof_color, roughness=0.95)

        # 覆斗四坡顶（金字塔形，底部方形，顶部收口）
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=half,
                                        radius2=half * 0.25, depth=h,
                                        location=(cx, cy, MUSEUM_HEIGHT + 0.2 + h / 2))
        pyramid = bpy.context.active_object
        pyramid.name = "覆斗顶_{}_{}".format(cave, dynasty)
        pyramid.rotation_euler = (0, 0, math.radians(45))
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        pyramid.data.materials.append(roof_mat)

        # 边缘浅刻敦煌忍冬纹样（四坡边缘装饰带，淡石青色点缀）
        # 在覆斗顶底部边缘添加忍冬纹饰带
        rengong_band_h = 0.15
        for sy_sign in [-1, 1]:
            add_box("覆斗_忍冬纹_{}_y{}".format(cave, sy_sign),
                    (cx, cy + sy_sign * half * 0.95, MUSEUM_HEIGHT + 0.3),
                    (size * 0.9, 0.06, rengong_band_h), rengong_mat)
        for sx_sign in [-1, 1]:
            add_box("覆斗_忍冬纹_{}_x{}".format(cave, sx_sign),
                    (cx + sx_sign * half * 0.95, cy, MUSEUM_HEIGHT + 0.3),
                    (0.06, size * 0.9, rengong_band_h), rengong_mat)

        # 忍冬纹细部装饰（四角卷草纹点缀，淡石绿色）
        rengong_detail_mat = create_material("覆斗_忍冬角饰_{}".format(cave),
                                             COLOR_DANSHILV, roughness=0.6)
        for sx in [-1, 1]:
            for sy in [-1, 1]:
                add_box("覆斗_忍冬角_{}_{}{}".format(cave, sx, sy),
                        (cx + sx * half * 0.85, cy + sy * half * 0.85, MUSEUM_HEIGHT + 0.35),
                        (0.25, 0.25, 0.08), rengong_detail_mat)

        # 顶部采光口（漫射光板）
        add_plane("覆斗_采光口_{}".format(cave),
                  (cx, cy, MUSEUM_HEIGHT + 0.2 + h - 0.05),
                  (half * 0.4, half * 0.4, 1), light_mat)

        # 四坡顶底部原木框架（四角立柱）
        for sx in [-1, 1]:
            for sy in [-1, 1]:
                add_box("覆斗_框_{}_{}{}".format(cave, sx, sy),
                        (cx + sx * half, cy + sy * half, MUSEUM_HEIGHT + 0.1),
                        (0.18, 0.18, 0.3), yuanmu_mat)

        # 四坡顶底部原木横梁
        for sy in [-1, 1]:
            add_box("覆斗_梁_{}_y{}".format(cave, sy),
                    (cx, cy + sy * half, MUSEUM_HEIGHT + 0.25),
                    (size + 0.2, 0.15, 0.15), yuanmu_mat)
        for sx in [-1, 1]:
            add_box("覆斗_梁_{}_x{}".format(cave, sx),
                    (cx + sx * half, cy, MUSEUM_HEIGHT + 0.25),
                    (0.15, size + 0.2, 0.15), yuanmu_mat)

        print("    {}窟{}覆斗顶完成 (尺寸:{}, 高度:{}, 前后错落:{})".format(
            cave, dynasty, size, h, cy))

    print("  五座覆斗四坡采光顶完成（前后错落排布+忍冬纹边缘）")


def create_alternating_facade():
    """
    立面虚实交替设计：夯土实墙 + 雕刻莲花飞天纹木质漏窗 + 通透原木立柱栏杆
    融合苏州园林漏景造境，打造移步换景光影层次
    """
    print("  创建虚实交替立面")

    hangtu_mat = create_material("实墙_夯土", COLOR_HANGTU, roughness=0.95)
    yuanmu_mat = create_material("漏窗_原木", COLOR_YUANMU, roughness=0.75)
    lou_chuang_mat = create_material("漏窗_忍冬纹", COLOR_DANSHIQING, roughness=0.6)
    langan_mat = create_material("栏杆_原木", COLOR_MUHE, roughness=0.78)
    # 莲花飞天纹专用材质（淡石青+淡石绿点缀，低饱和敦煌矿物色系）
    lianhua_feitian_mat = create_material("漏窗_莲花飞天", COLOR_DANSHIQING, roughness=0.55)
    feitian_dianzhui_mat = create_material("漏窗_飞天点缀", COLOR_DANSHILV, roughness=0.5)

    # 分段交替：每6米一段，实墙/漏窗/栏杆三种交替
    segment_length = 6.0
    segment_types = ["实墙", "漏窗", "栏杆"]  # 三种交替

    x = 0.0
    seg_index = 0
    while x < MUSEUM_LENGTH:
        seg_type = segment_types[seg_index % 3]
        seg_end = min(x + segment_length, MUSEUM_LENGTH)
        seg_center = (x + seg_end) / 2
        seg_w = seg_end - x

        if seg_type == "实墙":
            # 夯土实墙段（前后两面，带自然斑驳肌理）
            for sy_sign in [-1, 1]:
                wall_y = sy_sign * (MUSEUM_WIDTH / 2 + 0.15)
                create_bumpy_wall("实墙_{}_{}".format(seg_index, "前" if sy_sign < 0 else "后"),
                                  (seg_center, wall_y, MUSEUM_HEIGHT / 2),
                                  (MUSEUM_HEIGHT, seg_w, 0.25),
                                  hangtu_mat,
                                  bumpiness=0.2, subdivisions=5)
                # 实墙斑驳肌理（风化痕迹，摒弃扁平纯色块）
                bumpy_seg_mat = create_material(
                    "实墙斑驳_{}_{}".format(seg_index, "前" if sy_sign < 0 else "后"),
                    (0.58, 0.48, 0.34) if seg_index % 2 == 0 else (0.65, 0.55, 0.40),
                    roughness=0.96)
                add_box("实墙斑驳块_{}_{}".format(seg_index, "前" if sy_sign < 0 else "后"),
                        (seg_center, wall_y + sy_sign * 0.02, MUSEUM_HEIGHT * 0.4),
                        (seg_w * 0.9, 0.04, 0.8), bumpy_seg_mat)

        elif seg_type == "漏窗":
            # 木质漏窗段（雕刻莲花飞天纹，融合苏州园林漏景造境）
            for sy_sign in [-1, 1]:
                wall_y = sy_sign * (MUSEUM_WIDTH / 2 + 0.15)
                # 漏窗框架（原木，深褐哑光）
                add_box("漏窗框_{}_{}".format(seg_index, "前" if sy_sign < 0 else "后"),
                        (seg_center, wall_y, MUSEUM_HEIGHT / 2),
                        (seg_w, 0.12, MUSEUM_HEIGHT), yuanmu_mat)
                # 漏窗内部忍冬莲花纹（淡石青色装饰板）
                add_box("忍冬纹_{}_{}".format(seg_index, "前" if sy_sign < 0 else "后"),
                        (seg_center, wall_y, MUSEUM_HEIGHT - 0.8),
                        (seg_w * 0.8, 0.06, 0.8), lou_chuang_mat)
                # 中部莲花纹（雕刻莲花飞天纹核心装饰）
                add_box("莲花纹_{}_{}".format(seg_index, "前" if sy_sign < 0 else "后"),
                        (seg_center, wall_y, MUSEUM_HEIGHT / 2),
                        (seg_w * 0.7, 0.06, 1.2), lianhua_feitian_mat)
                # 飞天纹点缀（淡石绿色，少量点缀格栅纹样）
                for f in range(3):
                    fx = x + 1.0 + f * (seg_w - 2.0) / 2
                    add_box("飞天纹_{}_{}_{}".format(seg_index, sy_sign, f),
                            (fx, wall_y, MUSEUM_HEIGHT * 0.65),
                            (0.6, 0.04, 0.4), feitian_dianzhui_mat)
                # 下部联珠纹
                for b in range(int(seg_w / 0.5)):
                    bx = x + 0.25 + b * 0.5
                    add_box("联珠_{}_{}_{}".format(seg_index, sy_sign, b),
                            (bx, wall_y, 0.6),
                            (0.15, 0.08, 0.15), lou_chuang_mat)

        else:  # 栏杆
            # 通透原木立柱栏杆廊道段（移步换景光影层次）
            for sy_sign in [-1, 1]:
                wall_y = sy_sign * (MUSEUM_WIDTH / 2 + 0.15)
                # 上横杆（原木扶手）
                add_box("栏杆上_{}_{}".format(seg_index, "前" if sy_sign < 0 else "后"),
                        (seg_center, wall_y, MUSEUM_HEIGHT - 0.5),
                        (seg_w, 0.1, 0.1), langan_mat)
                # 下横杆
                add_box("栏杆下_{}_{}".format(seg_index, "前" if sy_sign < 0 else "后"),
                        (seg_center, wall_y, 0.5),
                        (seg_w, 0.1, 0.1), langan_mat)
                # 竖向原木立柱栏杆（通透设计）
                rail_count = int(seg_w / 0.5)
                for r in range(rail_count + 1):
                    rx = x + r * 0.5
                    add_box("栏杆竖_{}_{}_{}".format(seg_index, sy_sign, r),
                            (rx, wall_y, MUSEUM_HEIGHT / 2),
                            (0.06, 0.06, MUSEUM_HEIGHT - 1.0), langan_mat)
                # 中部格栅纹样（少量淡石青点缀）
                gelan_mat = create_material("格栅纹_{}".format(seg_index),
                                            COLOR_DANSHIQING, roughness=0.6)
                add_box("格栅纹_{}_{}".format(seg_index, "前" if sy_sign < 0 else "后"),
                        (seg_center, wall_y, MUSEUM_HEIGHT * 0.35),
                        (seg_w * 0.85, 0.04, 0.3), gelan_mat)

        seg_index += 1
        x += segment_length

    print("  虚实交替立面完成（共{}段，含莲花飞天纹漏窗+原木立柱栏杆）".format(seg_index))


def create_recessed_cave_entrances():
    """
    建筑底端主入口：内凹仿莫高窟崖壁洞窟式主大门
    门前低矮砂岩影壁，打造观展中式仪式缓冲空间
    保留原两端入口逻辑，主入口（x=0）增强为崖壁洞窟式主大门
    """
    print("  创建内凹崖壁洞窟入口")

    cliff_mat = create_material("入口_崖壁砂岩", COLOR_ZHESHI_QIAN, roughness=0.95)
    yuanmu_mat = create_material("入口_原木框", COLOR_YUANMU, roughness=0.75)
    yingbi_mat = create_material("影壁_浅浮雕砂岩", COLOR_SHAMO, roughness=0.92)

    # 两端入口位置（保留原逻辑）
    entrances = [
        {"x": 0.0, "dir": -1, "name": "入口", "is_main": True},   # 建筑底端主入口
        {"x": MUSEUM_LENGTH, "dir": 1, "name": "出口", "is_main": False},
    ]

    for ent in entrances:
        ex = ent["x"]
        edir = ent["dir"]
        ename = ent["name"]
        is_main = ent["is_main"]

        # 内凹崖壁（从外墙内退1.5米）
        recess_depth = 1.5
        cliff_x = ex + edir * (-0.3)

        # 两侧崖壁（凹入形成洞窟入口感）
        for sy_sign in [-1, 1]:
            wall_y = sy_sign * 2.5
            create_bumpy_wall("入口崖壁_{}_{}".format(ename, sy_sign),
                              (cliff_x, wall_y, MUSEUM_HEIGHT / 2),
                              (MUSEUM_HEIGHT, 0.4, 2.0),
                              cliff_mat,
                              bumpiness=0.3, subdivisions=6)

        # 洞窟入口原木门框（主入口加大门洞尺寸）
        if is_main:
            door_h = 4.0  # 主入口更高大
            door_w = 5.0  # 主入口更宽阔
        else:
            door_h = 3.5
            door_w = 4.0
        add_box("入口门框_{}_上".format(ename),
                (cliff_x, 0, door_h + 0.15),
                (0.3, door_w + 0.4, 0.3), yuanmu_mat)
        for sy_sign in [-1, 1]:
            add_box("入口门框_{}_{}".format(ename, sy_sign),
                    (cliff_x, sy_sign * (door_w / 2 + 0.1), door_h / 2),
                    (0.3, 0.2, door_h), yuanmu_mat)

        # 主入口：内凹仿莫高窟崖壁洞窟式主大门加强
        if is_main:
            # 洞窟式门洞内凹加深（仿莫高窟崖壁洞窟）
            add_box("主入口_洞窟内凹_顶",
                    (cliff_x + edir * 0.5, 0, door_h + 0.05),
                    (1.2, door_w + 0.6, 0.15), cliff_mat)
            # 洞窟式门洞两侧内壁
            for sy_sign in [-1, 1]:
                add_box("主入口_洞窟内壁_{}".format(sy_sign),
                        (cliff_x + edir * 0.5, sy_sign * (door_w / 2 + 0.15), door_h / 2),
                        (1.2, 0.15, door_h), cliff_mat)
            # 门洞顶部风蚀纹加强（仿莫高窟崖壁风化痕迹）
            groove_deep_mat = create_material("主入口_风蚀深", COLOR_ZHESHI, roughness=0.98)
            for g in range(6):
                add_box("主入口风蚀_{}".format(g),
                        (cliff_x, 0, door_h + 0.4 + g * 0.3),
                        (0.1, door_w * 0.95, 0.08), groove_deep_mat)
            # 主入口上方崖壁飞天浮雕（敦煌崖壁标志性元素）
            feitian_relief_mat = create_material("主入口_飞天浮雕",
                                                  COLOR_ZHESHI_QIAN, roughness=0.85)
            add_box("主入口_飞天浮雕_左",
                    (cliff_x, -1.5, door_h + 0.8),
                    (0.08, 1.2, 0.8), feitian_relief_mat)
            add_box("主入口_飞天浮雕_右",
                    (cliff_x, 1.5, door_h + 0.8),
                    (0.08, 1.2, 0.8), feitian_relief_mat)

        # 门洞上方风蚀纹（保留原逻辑）
        groove_mat = create_material("入口风蚀_{}".format(ename),
                                     COLOR_ZHESHI, roughness=0.98)
        for g in range(4):
            add_box("入口风蚀_{}_{}".format(ename, g),
                    (cliff_x, 0, door_h + 0.5 + g * 0.25),
                    (0.08, door_w * 0.9, 0.06), groove_mat)

        # 浅浮雕砂岩影壁（入口前方）
        # 主入口：门前低矮砂岩影壁（低矮设计，打造观展中式仪式缓冲空间）
        if is_main:
            yingbi_height = 1.8  # 低矮砂岩影壁
            yingbi_width = 6.0
        else:
            yingbi_height = 3.0
            yingbi_width = 5.0
        yingbi_x = ex + edir * 2.5
        yingbi_y = 0
        add_box("影壁_{}".format(ename),
                (yingbi_x, yingbi_y, yingbi_height / 2),
                (0.3, yingbi_width, yingbi_height), yingbi_mat)
        # 影壁浅浮雕装饰
        relief_mat = create_material("影壁浮雕_{}".format(ename),
                                     COLOR_ZHESHI, roughness=0.85)
        add_box("影壁飞天_{}".format(ename),
                (yingbi_x + edir * 0.15, yingbi_y, yingbi_height * 0.7),
                (0.06, yingbi_width * 0.7, 0.6), relief_mat)
        add_box("影壁忍冬_{}".format(ename),
                (yingbi_x + edir * 0.15, yingbi_y, yingbi_height * 0.45),
                (0.06, yingbi_width * 0.7, 0.5), relief_mat)
        add_box("影壁莲花_{}".format(ename),
                (yingbi_x + edir * 0.15, yingbi_y, yingbi_height * 0.2),
                (0.06, yingbi_width * 0.7, 0.4), relief_mat)

        # 影壁顶部原木压顶
        add_box("影壁压顶_{}".format(ename),
                (yingbi_x, yingbi_y, yingbi_height + 0.1),
                (0.4, yingbi_width + 0.4, 0.15), yuanmu_mat)

        print("    {}内凹崖壁入口完成{}".format(ename, "（主入口崖壁洞窟式主大门）" if is_main else ""))

    print("  内凹崖壁洞窟入口完成（建筑底端主入口+低矮砂岩影壁）")


def create_side_corridors():
    """
    两侧延伸副廊：左右横向短廊道改造为半开放式休憩过渡廊
    外侧配砂岩浅浮雕影壁、戈壁枯石沙生植物造景
    弱化拼接突兀感，融合苏州园林造景逻辑
    """
    print("  创建两侧延伸副廊（半开放休憩过渡廊）")

    yuanmu_mat = create_material("副廊_原木", COLOR_YUANMU, roughness=0.78)
    shayan_mat = create_material("副廊_砂岩影壁", COLOR_SHAMO, roughness=0.92)
    kushi_mat = create_material("副廊_枯石", COLOR_ZHESHI, roughness=0.95)
    zhiwu_mat = create_material("副廊_沙生植物", COLOR_DANSHILV, roughness=0.85)
    # 浅浮雕装饰材质
    relief_mat = create_material("副廊_浅浮雕", COLOR_ZHESHI_QIAN, roughness=0.85)

    # 两侧延伸副廊位置（左右横向短廊道）
    side_corridors = [
        {"x": 0.0, "dir": -1, "name": "左侧副廊"},   # 左侧（x=0端）
        {"x": MUSEUM_LENGTH, "dir": 1, "name": "右侧副廊"},  # 右侧（x=MUSEUM_LENGTH端）
    ]

    for sc in side_corridors:
        sx = sc["x"]
        sdir = sc["dir"]
        sname = sc["name"]

        # 半开放式休憩过渡廊（向外延伸3米）
        corridor_length = 3.0
        corridor_x = sx + sdir * (corridor_length / 2 + 0.3)

        # 副廊原木地面（栈道板）
        add_box("副廊_地面_{}".format(sname),
                (corridor_x, 0, 0.05),
                (corridor_length, MUSEUM_WIDTH, 0.1), yuanmu_mat)

        # 副廊原木立柱（四角+中间）
        for col_x_offset in [-corridor_length / 2 + 0.3, 0, corridor_length / 2 - 0.3]:
            col_x = corridor_x + col_x_offset
            for sy_sign in [-1, 1]:
                add_box("副廊_立柱_{}_{}_{}".format(sname, col_x_offset, sy_sign),
                        (col_x, sy_sign * (MUSEUM_WIDTH / 2 - 0.3), MUSEUM_HEIGHT / 2),
                        (0.18, 0.18, MUSEUM_HEIGHT), yuanmu_mat)

        # 副廊原木横梁（顶部）
        for sy_sign in [-1, 1]:
            add_box("副廊_横梁_{}_{}".format(sname, sy_sign),
                    (corridor_x, sy_sign * (MUSEUM_WIDTH / 2 - 0.3), MUSEUM_HEIGHT - 0.15),
                    (corridor_length, 0.15, 0.15), yuanmu_mat)

        # 副廊顶部原木椽子（横向排列）
        for r in range(int(corridor_length / 0.5) + 1):
            rx = corridor_x - corridor_length / 2 + r * 0.5
            add_box("副廊_椽子_{}_{}".format(sname, r),
                    (rx, 0, MUSEUM_HEIGHT - 0.05),
                    (0.08, MUSEUM_WIDTH - 0.4, 0.08), yuanmu_mat)

        # 副廊外侧砂岩浅浮雕影壁（弱化拼接突兀感）
        yingbi_x = corridor_x + sdir * (corridor_length / 2 + 0.2)
        add_box("副廊_影壁_{}".format(sname),
                (yingbi_x, 0, MUSEUM_HEIGHT / 2),
                (0.3, MUSEUM_WIDTH + 1.0, MUSEUM_HEIGHT), shayan_mat)

        # 影壁浅浮雕装饰（敦煌忍冬莲花纹）
        add_box("副廊_影壁飞天_{}".format(sname),
                (yingbi_x + sdir * 0.15, 0, MUSEUM_HEIGHT * 0.7),
                (0.06, MUSEUM_WIDTH * 0.8, 0.8), relief_mat)
        add_box("副廊_影壁忍冬_{}".format(sname),
                (yingbi_x + sdir * 0.15, 0, MUSEUM_HEIGHT * 0.45),
                (0.06, MUSEUM_WIDTH * 0.8, 0.6), relief_mat)
        add_box("副廊_影壁莲花_{}".format(sname),
                (yingbi_x + sdir * 0.15, 0, MUSEUM_HEIGHT * 0.2),
                (0.06, MUSEUM_WIDTH * 0.8, 0.5), relief_mat)

        # 影壁顶部原木压顶
        add_box("副廊_影壁压顶_{}".format(sname),
                (yingbi_x, 0, MUSEUM_HEIGHT + 0.1),
                (0.4, MUSEUM_WIDTH + 1.4, 0.15), yuanmu_mat)

        # 戈壁枯石沙生植物造景（影壁外侧）
        gobi_x = yingbi_x + sdir * 1.0
        # 沙生植物（左右各3株，淡石绿色）
        for p in range(3):
            py = -MUSEUM_WIDTH / 2 + 2 + p * 2
            add_box("副廊_植物_{}_{}".format(sname, p),
                    (gobi_x, py, 0.3),
                    (0.1, 0.1, 0.5 + p * 0.15), zhiwu_mat)

        # 枯石造景（影壁外侧左右各一组）
        for sy_sign in [-1, 1]:
            bpy.ops.mesh.primitive_ico_sphere_add(
                subdivisions=1, radius=0.45,
                location=(gobi_x + sdir * 0.3, sy_sign * (MUSEUM_WIDTH / 2 + 0.5), 0.2))
            stone = bpy.context.active_object
            stone.name = "副廊_枯石_{}_{}".format(sname, sy_sign)
            stone.scale = (1.2, 0.9, 0.6)
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
            stone.data.materials.append(kushi_mat)

        print("    {}完成（半开放休憩过渡廊+砂岩影壁+戈壁造景）".format(sname))

    print("  两侧延伸副廊完成")


def create_wooden_corridor_system():
    """
    整体外廊原木栈道系统：等距原木立柱檐廊
    模拟石窟前木栈道，横向长条崖阁木构长廊基底
    """
    print("  创建原木栈道廊柱系统")

    yuanmu_mat = create_material("栈道_原木", COLOR_YUANMU, roughness=0.78)
    shamo_mat = create_material("栈道_砂岩", COLOR_SHAMO, roughness=0.90)
    lianhua_mat = create_material("柱头_莲花纹", COLOR_DANSHIQING, roughness=0.6)

    # 前后廊原木栈道板
    add_box("前廊_栈道板",
            (MUSEUM_LENGTH / 2, -MUSEUM_WIDTH / 2 - 0.5, 0.05),
            (MUSEUM_LENGTH, 1.0, 0.1), yuanmu_mat)
    add_box("后廊_栈道板",
            (MUSEUM_LENGTH / 2, MUSEUM_WIDTH / 2 + 0.5, 0.05),
            (MUSEUM_LENGTH, 1.0, 0.1), yuanmu_mat)

    # 等距原木立柱（每3米一根，贯穿全馆）
    col_spacing = 3.0
    x = 1.5
    col_index = 0
    while x < MUSEUM_LENGTH - 1.5:
        add_box("栈道柱_前{}".format(col_index),
                (x, -MUSEUM_WIDTH / 2 - 0.7, MUSEUM_HEIGHT / 2),
                (0.18, 0.18, MUSEUM_HEIGHT), yuanmu_mat)
        add_box("柱头莲花_前{}".format(col_index),
                (x, -MUSEUM_WIDTH / 2 - 0.7, MUSEUM_HEIGHT - 0.05),
                (0.28, 0.28, 0.12), lianhua_mat)
        add_box("栈道柱_后{}".format(col_index),
                (x, MUSEUM_WIDTH / 2 + 0.7, MUSEUM_HEIGHT / 2),
                (0.18, 0.18, MUSEUM_HEIGHT), yuanmu_mat)
        add_box("柱头莲花_后{}".format(col_index),
                (x, MUSEUM_WIDTH / 2 + 0.7, MUSEUM_HEIGHT - 0.05),
                (0.28, 0.28, 0.12), lianhua_mat)
        col_index += 1
        x += col_spacing

    # 栈道扶手（原木横杆）
    add_box("前廊_扶手",
            (MUSEUM_LENGTH / 2, -MUSEUM_WIDTH / 2 - 0.7, MUSEUM_HEIGHT - 0.3),
            (MUSEUM_LENGTH, 0.08, 0.08), yuanmu_mat)
    add_box("后廊_扶手",
            (MUSEUM_LENGTH / 2, MUSEUM_WIDTH / 2 + 0.7, MUSEUM_HEIGHT - 0.3),
            (MUSEUM_LENGTH, 0.08, 0.08), yuanmu_mat)

    print("  原木栈道廊柱系统完成（共{}对）".format(col_index))


def create_desert_landscape():
    """
    戈壁枯石造景：沙生植物 + 枯石
    借鉴苏州园林造景逻辑，替换为戈壁元素
    """
    print("  创建戈壁枯石造景")

    shamo_mat = create_material("戈壁_沙地", COLOR_SHAMO, roughness=1.0)
    kushi_mat = create_material("戈壁_枯石", COLOR_ZHESHI, roughness=0.95)
    zhiwu_mat = create_material("戈壁_沙生植物", COLOR_SHILV, roughness=0.85)

    # 前后廊沙地铺装
    add_box("戈壁_前沙地",
            (MUSEUM_LENGTH / 2, -MUSEUM_WIDTH / 2 - 1.5, -0.02),
            (MUSEUM_LENGTH, 2.0, 0.04), shamo_mat)
    add_box("戈壁_后沙地",
            (MUSEUM_LENGTH / 2, MUSEUM_WIDTH / 2 + 1.5, -0.02),
            (MUSEUM_LENGTH, 2.0, 0.04), shamo_mat)

    # 枯石造景（每隔12米一组）
    for x in range(6, int(MUSEUM_LENGTH), 12):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.4,
            location=(x, -MUSEUM_WIDTH / 2 - 1.2, 0.2))
        stone = bpy.context.active_object
        stone.name = "戈壁_枯石_前{}".format(x)
        stone.scale = (1.2, 0.8, 0.6)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        stone.data.materials.append(kushi_mat)

        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.5,
            location=(x + 2, MUSEUM_WIDTH / 2 + 1.2, 0.2))
        stone2 = bpy.context.active_object
        stone2.name = "戈壁_枯石_后{}".format(x)
        stone2.scale = (1.0, 1.2, 0.7)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        stone2.data.materials.append(kushi_mat)

        for p in range(3):
            add_box("戈壁_植物_{}_{}".format(x, p),
                    (x + p * 0.3 - 0.3,
                     -MUSEUM_WIDTH / 2 - 1.5 if p % 2 == 0 else MUSEUM_WIDTH / 2 + 1.5,
                     0.3),
                    (0.08, 0.08, 0.6 + p * 0.1), zhiwu_mat)

    print("  戈壁枯石造景完成")



# ============================================================
# 主函数
# ============================================================
def main():
    print("=" * 60)
    print("敦煌风格 3D 博物馆生成器（专业标准版）")
    print("=" * 60)

    # 验证图片目录
    if not os.path.isdir(IMAGE_DIR):
        print("错误: 图片目录不存在: {}".format(IMAGE_DIR))
        return

    print("图片目录: {}".format(IMAGE_DIR))
    print("输出文件: {}".format(OUTPUT_BLEND))
    print()
    print("展馆规格:")
    print("  总尺寸: {}m x {}m x {}m".format(MUSEUM_LENGTH, MUSEUM_WIDTH, MUSEUM_HEIGHT))
    print("  四大功能区: 序厅 / 洞窟区 / 陈列区 / 数字区")
    print("  复刻洞窟: 5间 (285窟/45窟/217窟/17窟/3窟)")
    print()

    # 构建
    clear_scene()
    create_museum_structure()
    create_entrance_hall()
    create_cave_area()
    create_display_area()
    create_digital_area()

    # --- 视觉美术与空间布局升级 ---
    create_wall_mural_textures()
    create_cliff_facade()
    create_cave_number_labels()
    create_walkways_and_stairs()
    create_corridor_decorations()
    create_cave_interior_details()

    # --- 中式建筑外观升级 ---
    create_chinese_architecture_facade()

    create_lighting()
    create_cameras()
    setup_render()

    # 保存
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT_BLEND)
    print()
    print("=" * 60)
    print("3D 博物馆生成完成!")
    print("输出文件: {}".format(OUTPUT_BLEND))
    print("=" * 60)


if __name__ == "__main__":
    main()
