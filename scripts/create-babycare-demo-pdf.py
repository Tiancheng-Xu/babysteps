from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

OUT = "output/pdf/babysteps-babycare-product-demo-guide-zh.pdf"
navy = colors.HexColor("#153b53")
ink = colors.HexColor("#243746")
gold = colors.HexColor("#a47738")
cream = colors.HexColor("#fbf7ed")
styles = getSampleStyleSheet()
pdfmetrics.registerFont(TTFont("ZHFont", "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/53fe5be564086fefc7523ccd0a31200acf92e0e5.asset/AssetData/STHEITI.ttf"))
styles.add(ParagraphStyle(name="ZHTitle", parent=styles["Title"], fontName="ZHFont", fontSize=24, leading=32, textColor=navy, alignment=TA_CENTER, spaceAfter=10))
styles.add(ParagraphStyle(name="ZHSub", parent=styles["Normal"], fontName="ZHFont", fontSize=11, leading=17, textColor=ink, alignment=TA_CENTER, spaceAfter=18))
styles.add(ParagraphStyle(name="ZHHead", parent=styles["Heading2"], fontName="ZHFont", fontSize=16, leading=22, textColor=navy, spaceBefore=12, spaceAfter=8))
styles.add(ParagraphStyle(name="ZHBody", parent=styles["BodyText"], fontName="ZHFont", fontSize=10.5, leading=17, textColor=ink, spaceAfter=7))
styles.add(ParagraphStyle(name="ZHSmall", parent=styles["BodyText"], fontName="ZHFont", fontSize=9, leading=14, textColor=ink))
styles.add(ParagraphStyle(name="ZHSmallWhite", parent=styles["BodyText"], fontName="ZHFont", fontSize=9, leading=14, textColor=colors.white))

def P(text, style="ZHBody"):
    return Paragraph(text, styles[style])

def footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(navy)
    canvas.rect(0, 0, A4[0], 8 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("ZHFont", 8)
    canvas.drawRightString(A4[0] - 18 * mm, 3 * mm, f"BabySteps · 产品说明证据 · {doc.page}")
    canvas.restoreState()

doc = SimpleDocTemplate(OUT, pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm, topMargin=16 * mm, bottomMargin=14 * mm)
story = [
    Spacer(1, 12 * mm),
    P("BabySteps", "ZHTitle"),
    P("中国 + 日本海外亲子社交商业化产品说明", "ZHSub"),
    Table([[P("定位", "ZHSmall"), P("为 Babycare 海外市场提供低门槛的亲子陪伴入口：先让家庭在 3 分钟内获得价值，再逐步沉淀登录、会员、门店活动与品牌权益。", "ZHSmall")]], colWidths=[28 * mm, 137 * mm], style=TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), navy), ("TEXTCOLOR", (0, 0), (0, -1), colors.white), ("BACKGROUND", (1, 0), (1, -1), colors.HexColor("#eef4f5")), ("BOX", (0, 0), (-1, -1), 1, gold), ("INNERGRID", (0, 0), (-1, -1), .5, gold), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10)])),
    P("一、为什么适合 Babycare 海外布局", "ZHHead"),
    P("Babycare 已经拥有婴儿车、纸尿裤等高频育儿产品。BabySteps 把一次购买关系延展为持续陪伴关系：家长先按宝宝阶段、国家和城市获得一个真实可执行的小任务，再决定是否登录、参与品牌活动或进入更深的会员服务。中国与日本可先做本地化试点，验证内容偏好、活动触达与复购助推，不要求用户先理解 Web3。"),
    P("商业叙事：提前布局亲子社交应用，为海外门店扩充和新品上市造势。社区不是替代产品销售，而是把产品使用场景、门店活动、口碑内容和权益核销组织成可持续的家庭旅程。"),
    P("二、当前可见产品流程", "ZHHead"),
    Table([[P("1 · 选择", "ZHSmall"), P("选择宝宝阶段、体验地区（中国 / 日本）与城市。", "ZHSmall")], [P("2 · 体验", "ZHSmall"), P("获得 3 分钟亲子陪伴任务，访客即可开始并完成。", "ZHSmall")], [P("3 · 沉淀", "ZHSmall"), P("记录保存在浏览器本地；需要跨设备、家庭协作或长期保存时，再用 Google / 邮箱登录。", "ZHSmall")], [P("4 · 进阶", "ZHSmall"), P("任务市场、家长中心、品牌权益和可选的钱包/链上记录分层呈现。", "ZHSmall")]], colWidths=[28 * mm, 137 * mm], style=TableStyle([("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#e8f0f3")), ("BOX", (0, 0), (-1, -1), .7, gold), ("INNERGRID", (0, 0), (-1, -1), .4, colors.HexColor("#c5d2d5")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)])),
    P("三、降低使用门槛的设计原则", "ZHHead"),
    P("• 首屏不强制登录、不强制连接钱包；先完成一次亲子任务。<br/>• 登录是价值升级，不是进入门票：跨设备保存、家庭协作和长期记录再请求登录。<br/>• Web3 只作为进阶凭证与可审计权益，不把密钥、交易或复杂术语放在首屏。<br/>• 中国、日本的市场与城市只做体验分流；真实社交、门店和品牌内容需经 Babycare 试点确认后接入。"),
    P("四、对 Babycare 的业务价值", "ZHHead"),
    P("• 海外用户增长：用 3 分钟价值建立首次互动，降低广告落地页到产品体验的流失。<br/>• 门店与新品造势：按城市编排亲子任务、门店活动和新品体验，形成可追踪的活动旅程。<br/>• 会员与复购：以家庭阶段和任务完成建立内容触达，再承接会员、优惠券和服务权益。<br/>• 中国 + 日本验证：同一产品骨架承载不同语言、内容和门店策略，便于比较试点效果。"),
    PageBreak(),
    P("五、8–12 周联合试点建议", "ZHHead"),
    Table([[P("阶段", "ZHSmallWhite"), P("目标", "ZHSmallWhite"), P("输出", "ZHSmallWhite")], [P("第 1–2 周", "ZHSmall"), P("冻结 6–10 个经品牌审核的亲子任务、同意文本与停止条件。", "ZHSmall"), P("中国 / 日本试点方案", "ZHSmall")], [P("第 3–6 周", "ZHSmall"), P("开放 300–1,000 个受邀家庭，观察激活、任务完成、反馈与门店活动触达。", "ZHSmall"), P("周度指标与访谈摘要", "ZHSmall")], [P("第 7–12 周", "ZHSmall"), P("复盘留存、权益核销和内容偏好，决定会员、优惠券、门店或公益场景。", "ZHSmall"), P("企业化路线与下一阶段预算", "ZHSmall")]], colWidths=[28 * mm, 92 * mm, 45 * mm], style=TableStyle([("BACKGROUND", (0, 0), (-1, 0), navy), ("BOX", (0, 0), (-1, -1), .7, gold), ("INNERGRID", (0, 0), (-1, -1), .4, colors.HexColor("#c5d2d5")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)])),
    P("六、数据与合规边界", "ZHHead"),
    P("当前访客试用只记录粗粒度的阶段、国家 / 地区、城市、任务和完成状态，并保存在浏览器本地。试点不采集儿童健康、学校、位置或照片；登录、品牌权益和任何后续社交能力均应以明确同意、最小化数据和地区合规评审为前提。钱包与链上能力保持可选，不作为普通家长的使用门槛。"),
    P("七、当前产品与证据", "ZHHead"),
    P("线上产品：<link href='https://babysteps.baby2b.online/' color='#153b53'>https://babysteps.baby2b.online/</link><br/>产品 Evidence：<link href='https://babysteps.baby2b.online/evidence/' color='#153b53'>https://babysteps.baby2b.online/evidence/</link><br/>本说明对应 Babycare 演示分支的访客优先流程；录屏覆盖首页、三分钟任务、进阶能力、任务页、家长中心、个人中心与 Evidence。"),
    P("八、下一步合作讨论", "ZHHead"),
    P("建议由 Babycare 中国与日本团队共同确认：首批试点国家与城市、品牌审核任务、门店活动权益、语言与客服边界、数据合规要求，以及 8–12 周的成功标准。产品侧可在不改变家庭使用习惯的前提下，快速提供内容配置、活动旅程与效果复盘。"),
]
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUT)
