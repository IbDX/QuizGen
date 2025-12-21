
import { ErrorCode } from '../types';

export const translations = {
    en: {
        // Layout & Settings
        "home": "HOME",
        "library": "LIBRARY",
        "settings": "SETTINGS",
        "system_preferences": "SYSTEM CONFIGURATION",
        "settings_interface": "INTERFACE",
        "settings_display": "DISPLAY",
        "settings_visuals": "VISUAL FX",
        "settings_system": "SYSTEM & SUPPORT",
        "ui_theme": "UI THEME",
        "system_language": "SYSTEM LANGUAGE",
        "font_family": "SYSTEM FONT",
        "global_font_scale": "GLOBAL FONT SCALE",
        "digital_background": "DIGITAL BACKGROUND",
        "matrix_rain": "MATRIX RAIN ANIMATION",
        "full_width": "FULL WIDTH VIEW",
        "auto_hide_menu": "AUTO-HIDE TOP MENU",
        "auto_hide_footer": "AUTO-HIDE BOTTOM BAR",
        "terminal_cursor": "TERMINAL CURSOR",
        "save_close": "SAVE & CLOSE",
        "status_online": "STATUS: ONLINE | SYSTEM: READY",
        "exit_exam_warning_title": "Exit Exam?",
        "exit_exam_warning_body": "Are you sure you want to exit? All progress will be lost.",
        "confirm_action": "CONFIRM EXIT",
        "cancel_action": "CANCEL",
        "advanced_settings": "ADVANCED SETTINGS",
        "report_issue": "REPORT BUG / ISSUE",

        // Upload
        "secure_upload": "SECURE FILE UPLOAD",
        "analyzing_batch": "ANALYZING BATCH...",
        "executing_protocols": "Executing Security Protocols on individual files...",
        "tap_to_select": "Tap to Select or Drag & Drop Multiple PDFs/Images",
        "or_via_network": "OR VIA NETWORK",
        "fetch": "FETCH",
        "quick_test": "QUICK DIAGNOSTIC TEST",
        "demo_desc": "Run a comprehensive simulation covering C++, Python, JS, Math Graphs, and UML Diagrams.",
        "load_demo": "LOAD DEMO",
        "paste_tip_desktop": "Tip: You can Paste (Ctrl+V) or Drag & Drop files/URLs anywhere.",
        "paste_tip_mobile": "Tip: Use the 'Paste from Clipboard' button or paste URLs into the box.",
        "paste_from_clipboard": "PASTE FROM CLIPBOARD",
        "clipboard_denied": "Permission Denied. Tap input box below to paste manually.",

        // AI Builder Card & Interface
        "builder_card_title": "AI EXAM BUILDER",
        "builder_card_desc": "Chat with AI to design a custom exam.",
        "start_builder": "START BUILDER",
        "builder_title": "AI EXAM BUILDER",
        "builder_mode": "[INTERACTIVE MODE]",
        "abort": "[ESC] ABORT",
        "init_system": "INITIALIZE SYSTEM",
        "select_lang_msg": "Select conversation language to begin.",
        "user_role": "USER",
        "agent_role": "SYSTEM AGENT",
        "compiling": "COMPILING EXAM DATA...",
        "connection_error": "Connection interrupted. Please try again.",
        "builder_generate": "GENERATE FINAL EXAM",
        "builder_negotiate_hint": "Negotiate exam content above. Click 'GENERATE EXAM' when ready.",
        "exam_ready": "EXAM GENERATED SUCCESSFULLY",
        "exam_ready_desc": "Your custom exam is ready. You can start it immediately, save it to your library, or download it.",
        "download_zplus": "DOWNLOAD .ZPLUS",
        "save_library": "SAVE TO LIBRARY",
        "start_now": "START NOW",
        "suggested_title": "TITLE",
        "questions_count": "QUESTIONS",
        "time_limit": "TIME LIMIT",
        "mode": "MODE",
        "minutes": "mins",

        // Config
        "configuration": "CONFIGURATION",
        "target_sources": "TARGET SOURCES",
        "add_more": "ADD MORE FILES",
        "output_lang": "OUTPUT LANGUAGE",
        "output_format": "OUTPUT_FORMAT_OVERRIDE",
        "mode_select": "MODE_SELECT",
        "time_alloc": "TIME_ALLOCATION",
        "enable_timer": "ENABLE TIMER",
        "initiate_exam": "INITIATE_EXAM",
        "scanning": "SCANNING...",
        "original_lang": "ORIGINAL (Auto)",
        "lang_desc_auto": "Preserves the language of the source document(s).",
        "lang_desc_en": "Exam generated entirely in English.",
        "lang_desc_ar": "Exam questions in Arabic, code in English.",
        
        // Exam Runner
        "question": "QUESTION",
        "time_remaining": "TIME",
        "execution_progress": "EXECUTION_PROGRESS",
        "prev": "PREV",
        "next": "NEXT",
        "check": "CHECK",
        "submit": "SUBMIT",
        "validating": "VALIDATING...",
        "short_answer": "SHORT ANSWER / OPEN RESPONSE",
        "output_terminal": "OUTPUT_TERMINAL",
        "editor": "EDITOR",
        "max_chars": "MAX 5000 CHARS",
        "security_alert": "SECURITY ALERT",
        "no_answer_provided": "No answer provided.",

        // Results
        "assessment_complete": "ASSESSMENT COMPLETE",
        "critical_failure": "CRITICAL SYSTEM FAILURE",
        "perfection": "PERFECTION ACHIEVED",
        "final_score": "FINAL SCORE",
        "grade": "GRADE",
        "agent_name": "AGENT_NAME",
        "enter_agent_name": "ENTER_AGENT_NAME",
        "publish": "PUBLISH",
        "save": "SAVE",
        "save_full_exam": "SAVE FULL EXAM",
        "saved": "SAVED",
        "pdf_report": "PDF REPORT",
        "retake": "RETAKE",
        "restart": "RESTART",
        "remediate": "REMEDIATE",
        "view_weak_points": "VIEW WEAK POINTS",
        "hide_analysis": "HIDE ANALYSIS",
        "show_full_exam": "SHOW FULL EXAM",
        "show_errors_only": "SHOW ERRORS ONLY",
        "areas_improvement": "AREAS FOR IMPROVEMENT",
        "passed": "PASSED",
        "failed": "FAILED",
        "your_input": "YOUR INPUT",
        "analysis": "ANALYSIS",
        "system_locked": "SYSTEM LOCKED: PUBLISHING DISABLED",
        "published": "PUBLISHED",
        "watch_tutorial": "WATCH TUTORIAL",
        "read_docs": "READ DOCS",
        "weak_point_diagnostics": "WEAK POINT DIAGNOSTICS",
        "score_too_low": "SCORE TOO LOW TO PUBLISH",

        // Library
        "saved_questions": "SAVED QUESTIONS",
        "saved_exams": "SAVED EXAMS",
        "no_saved_exams": "NO SAVED EXAMS",
        "load_retake": "LOAD & RETAKE EXAM",
        "library_empty": "QUESTION LIBRARY IS EMPTY",
        "import_exam": "IMPORT EXAM (.zplus)",
        "export_exam": "EXPORT",
        "import_success": "Exam imported successfully.",
        "import_failed": "Invalid .zplus file.",

        // AI Helper
        "ai_helper_title": "SYSTEM SUPPORT",
        "ai_helper_placeholder": "Ask about using Z+...",
        "ai_helper_welcome": "Greetings, Agent. I am the Z+ System Support Unit. I can assist with troubleshooting, explaining features (like Modes or Badges), or guiding you through the upload process. How may I assist?"
    },
    ar: {
        // Layout & Settings
        "home": "الرئيسية",
        "library": "المكتبة",
        "settings": "الإعدادات",
        "system_preferences": "تكوين النظام",
        "settings_interface": "الواجهة",
        "settings_display": "العرض",
        "settings_visuals": "المؤثرات البصرية",
        "settings_system": "النظام والدعم",
        "ui_theme": "سمة الواجهة",
        "system_language": "لغة النظام",
        "font_family": "خط النظام",
        "global_font_scale": "مقياس الخط العام",
        "digital_background": "الخلفية الرقمية",
        "matrix_rain": "رسوم المطر الرقمي",
        "full_width": "عرض كامل",
        "auto_hide_menu": "إخفاء القائمة العلوية تلقائياً",
        "auto_hide_footer": "إخفاء الشريط السفلي تلقائياً",
        "terminal_cursor": "مؤشر الطرفية",
        "save_close": "حفظ وإغلاق",
        "status_online": "الحالة: متصل | النظام: جاهز",
        "exit_exam_warning_title": "الخروج من الاختبار؟",
        "exit_exam_warning_body": "هل أنت متأكد من رغبتك في الخروج؟ سيتم فقدان كل التقدم.",
        "confirm_action": "تأكيد الخروج",
        "cancel_action": "إلغاء",
        "advanced_settings": "إعدادات متقدمة",
        "report_issue": "الإبلاغ عن مشكلة / خطأ",

        // Upload
        "secure_upload": "رفع الملفات الآمن",
        "analyzing_batch": "جاري تحليل الحزمة...",
        "executing_protocols": "تنفيذ بروتوكولات الأمان على الملفات...",
        "tap_to_select": "اضغط للاختيار أو اسحب الملفات (PDF/صور)",
        "or_via_network": "أو عبر الشبكة",
        "fetch": "جلب",
        "quick_test": "اختبار تشخيصي سريع",
        "demo_desc": "تشغيل محاكاة شاملة تغطي C++ و Python و JS والرسوم البيانية والمخططات.",
        "load_demo": "تشغيل العرض التجريبي",
        "paste_tip_desktop": "نصيحة: يمكنك لصق (Ctrl+V) أو سحب وإفلات الملفات/الروابط في أي مكان.",
        "paste_tip_mobile": "نصيحة: استخدم زر 'اللصق من الحافظة' أو الصق الروابط في الصندوق.",
        "paste_from_clipboard": "اللصق من الحافظة",
        "clipboard_denied": "تم رفض الإذن. اضغط على مربع الإدخال للصق يدوياً.",
        
        // AI Builder Card & Interface
        "builder_card_title": "منشئ الاختبارات الذكي",
        "builder_card_desc": "تحدث مع الذكاء الاصطناعي لتصميم اختبار مخصص.",
        "start_builder": "ابدأ المنشئ",
        "builder_title": "منشئ الاختبارات الذكي",
        "builder_mode": "[الوضع التفاعلي]",
        "abort": "[ESC] خروج",
        "init_system": "تهيئة النظام",
        "select_lang_msg": "اختر لغة المحادثة للبدء.",
        "user_role": "المستخدم",
        "agent_role": "عميل النظام",
        "compiling": "جاري تجميع بيانات الاختبار...",
        "connection_error": "انقطع الاتصال. يرجى المحاولة مرة أخرى.",
        "builder_generate": "إنشاء الاختبار النهائي",
        "builder_negotiate_hint": "اتفق على المحتوى أعلاه. اضغط 'إنشاء الاختبار' عند الانتهاء.",
        "exam_ready": "تم إنشاء الاختبار بنجاح",
        "exam_ready_desc": "اختبارك المخصص جاهز. يمكنك البدء فوراً، حفظه في المكتبة، أو تحميله.",
        "download_zplus": "تحميل ملف .ZPLUS",
        "save_library": "حفظ في المكتبة",
        "start_now": "ابدأ الآن",
        "suggested_title": "العنوان",
        "questions_count": "عدد الأسئلة",
        "time_limit": "الوقت",
        "mode": "الوضع",
        "minutes": "دقيقة",

        // Config
        "configuration": "إعداد الاختبار",
        "target_sources": "المصادر المستهدفة",
        "add_more": "إضافة ملفات",
        "output_lang": "لغة الاختبار",
        "output_format": "تنسيق المخرجات",
        "mode_select": "وضع الاختبار",
        "time_alloc": "تخصيص الوقت",
        "enable_timer": "تفعيل المؤقت",
        "initiate_exam": "بدء الاختبار",
        "scanning": "جاري الفحص...",
        "original_lang": "الأصلية (تلقائي)",
        "lang_desc_auto": "يحافظ على لغة المستند الأصلي.",
        "lang_desc_en": "الاختبار بالكامل باللغة الإنجليزية.",
        "lang_desc_ar": "الأسئلة بالعربية، الأكواد بالإنجليزية.",

        // Exam Runner
        "question": "سؤال",
        "time_remaining": "الوقت",
        "execution_progress": "تقدم التنفيذ",
        "prev": "سابق",
        "next": "تالي",
        "check": "تحقق",
        "submit": "إنهاء",
        "validating": "جاري التحقق...",
        "short_answer": "إجابة قصيرة / نصية",
        "output_terminal": "مخرجات الطرفية",
        "editor": "المحرر",
        "max_chars": "الحد الأقصى 5000 حرف",
        "security_alert": "تنبيه أمني",
        "no_answer_provided": "لم يتم تقديم إجابة.",

        // Results
        "assessment_complete": "اكتمل التقييم",
        "critical_failure": "فشل حرج في النظام",
        "perfection": "تم تحقيق الكمال",
        "final_score": "النتيجة النهائية",
        "grade": "التقدير",
        "agent_name": "اسم العميل",
        "enter_agent_name": "أدخل الاسم",
        "publish": "نشر",
        "save": "حفظ",
        "save_full_exam": "حفظ الاختبار كاملاً",
        "saved": "محفوظ",
        "pdf_report": "تقرير PDF",
        "retake": "إعادة",
        "restart": "خروج",
        "remediate": "معالجة الضعف",
        "view_weak_points": "عرض نقاط الضعف",
        "hide_analysis": "إخفاء التحليل",
        "show_full_exam": "عرض الاختبار بالكامل",
        "show_errors_only": "عرض الأخطاء فقط",
        "areas_improvement": "مجالات للتحسين",
        "passed": "ناجح",
        "failed": "راسب",
        "your_input": "إجابتك",
        "analysis": "التحليل",
        "system_locked": "النظام مقفل: النشر معطل",
        "published": "تم النشر",
        "watch_tutorial": "مشاهدة الشرح",
        "read_docs": "قراءة الوثائق",
        "weak_point_diagnostics": "تشخيص نقاط الضعف",
        "score_too_low": "الدرجة منخفضة جداً للنشر",

        // Library
        "saved_questions": "الأسئلة المحفوظة",
        "saved_exams": "الاختبارات المحفوظة",
        "no_saved_exams": "لا توجد اختبارات محفوظة",
        "load_retake": "تحميل وإعادة الاختبار",
        "library_empty": "مكتبة الأسئلة فارغة",
        "import_exam": "استيراد اختبار (.zplus)",
        "export_exam": "تصدير",
        "import_success": "تم استيراد الاختبار بنجاح.",
        "import_failed": "ملف .zplus غير صالح.",

        // AI Helper
        "ai_helper_title": "دعم النظام",
        "ai_helper_placeholder": "اسأل عن كيفية استخدام Z+...",
        "ai_helper_welcome": "تحياتي أيها العميل. أنا وحدة دعم نظام Z+. يمكنني المساعدة في حل المشكلات، شرح الميزات (مثل الأوضاع أو الشارات)، أو إرشادك خلال عملية الرفع. كيف يمكنني المساعدة؟"
    }
};

export const errorTranslations = {
  en: {
    [ErrorCode.NETWORK_TIMEOUT]: {
      title: "Connection Timed Out",
      msg: "The AI is taking too long to respond. Please check your connection and try again."
    },
    [ErrorCode.RATE_LIMIT]: {
      title: "System Busy",
      msg: "We are experiencing high traffic (Quota Exceeded). Please wait 30 seconds before retrying."
    },
    [ErrorCode.MALFORMED_RESPONSE]: {
      title: "Data Processing Error",
      msg: "The AI generated an invalid format. We are automatically retrying..."
    },
    [ErrorCode.PARTIAL_DATA]: {
      title: "Partial Success",
      msg: "Some content was unreadable and has been filtered out to ensure stability."
    },
    [ErrorCode.API_ERROR]: {
      title: "Server Error",
      msg: "Unable to contact Gemini servers."
    },
    [ErrorCode.UNKNOWN]: {
      title: "Unexpected Error",
      msg: "An unknown error occurred. Please refresh."
    }
  },
  ar: {
    [ErrorCode.NETWORK_TIMEOUT]: {
      title: "انتهت مهلة الاتصال",
      msg: "استغرق الذكاء الاصطناعي وقتاً طويلاً. يرجى التحقق من الإنترنت والمحاولة مجدداً."
    },
    [ErrorCode.RATE_LIMIT]: {
      title: "النظام مشغول جداً",
      msg: "حركة المرور عالية حالياً (تجاوز الحصة). يرجى الانتظار 30 ثانية."
    },
    [ErrorCode.MALFORMED_RESPONSE]: {
      title: "خطأ في معالجة البيانات",
      msg: "أنتج النظام تنسيقاً غير صالح. جاري إعادة المحاولة..."
    },
    [ErrorCode.PARTIAL_DATA]: {
      title: "نجاح جزئي",
      msg: "تم استبعاد بعض البيانات غير الصالحة لضمان استقرار النظام."
    },
    [ErrorCode.API_ERROR]: {
      title: "خطأ في الخادم",
      msg: "تعذر الاتصال بخوادم Gemini."
    },
    [ErrorCode.UNKNOWN]: {
      title: "خطأ غير متوقع",
      msg: "حدث خطأ غير معروف. يرجى تحديث الصفحة."
    }
  }
};

export type TranslationKey = keyof typeof translations['en'];

export const t = (key: TranslationKey | ErrorCode, lang: string): any => {
    // Check if it's an error code first for object return
    if (Object.values(ErrorCode).includes(key as ErrorCode)) {
        return errorTranslations[lang === 'ar' ? 'ar' : 'en'][key as ErrorCode];
    }
    return translations[lang === 'ar' ? 'ar' : 'en'][key as TranslationKey] || translations['en'][key as TranslationKey] || key;
};

const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
export const toArabicNumerals = (num: number | string): string => {
  return String(num).replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
};
