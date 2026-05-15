/**
 * i18n.js — Arabic / English language system for Business 3D
 * Uses data-i18n attributes for static HTML + MutationObserver for dynamic content.
 * Key: localStorage "crm_lang" = "ar" | "en"
 */
(function () {

  const AR = {
    // ── Navigation ──────────────────────────────────────────────────────────
    'Dashboard': 'لوحة التحكم',
    'Contacts': 'جهات الاتصال',
    'Companies': 'الشركات',
    'Deals': 'الصفقات',
    'Activities': 'الأنشطة',
    'Tasks': 'المهام',
    'Reminders': 'التذكيرات',
    'Reports': 'التقارير',
    'Calendar': 'التقويم',
    'Users': 'المستخدمون',
    'Lists': 'القوائم',
    'My Team': 'فريقي',

    // ── Topbar ───────────────────────────────────────────────────────────────
    'Search contacts, companies, deals...': 'بحث جهات الاتصال، الشركات، الصفقات...',
    'Toggle dark mode': 'تبديل الوضع الداكن',
    'Viewing:': 'عرض:',

    // ── Common buttons ───────────────────────────────────────────────────────
    'Add': 'إضافة',
    'Edit': 'تعديل',
    'Delete': 'حذف',
    'Save': 'حفظ',
    'Cancel': 'إلغاء',
    'Close': 'إغلاق',
    'Save Changes': 'حفظ التغييرات',
    'Add Contact': 'إضافة جهة اتصال',
    'Add Company': 'إضافة شركة',
    'Add Deal': 'إضافة صفقة',
    'Add Activity': 'إضافة نشاط',
    'Add Task': 'إضافة مهمة',
    'Add Reminder': 'إضافة تذكير',
    'Add User': 'إضافة مستخدم',
    'Import': 'استيراد',
    'Export': 'تصدير',
    'Export CSV': 'تصدير CSV',
    'Backup': 'نسخ احتياطي',
    'Restore': 'استعادة',
    'Send Email': 'إرسال بريد إلكتروني',
    'WhatsApp': 'واتساب',
    'WhatsApp Broadcast': 'رسالة واتساب جماعية',
    'Team Task': 'مهمة للفريق',
    'Mark done': 'تحديد كمنجز',
    'Log Call': 'تسجيل مكالمة',
    'Log Visit': 'تسجيل زيارة',
    'Log Email': 'تسجيل بريد',
    'Add Note': 'إضافة ملاحظة',
    'Print / PDF': 'طباعة / PDF',
    'Merge duplicate': 'دمج مكرر',
    'Refresh': 'تحديث',
    'Clear': 'مسح',
    'Apply': 'تطبيق',
    'Search': 'بحث',
    'Filter': 'تصفية',
    'Select All': 'تحديد الكل',
    'Deselect All': 'إلغاء تحديد الكل',
    'Home': 'الرئيسية',

    // ── Status / filters ─────────────────────────────────────────────────────
    'All': 'الكل',
    'Pending': 'قيد الانتظار',
    'Completed': 'مكتمل',
    'Active': 'نشط',
    'Inactive': 'غير نشط',
    'All Status': 'كل الحالات',
    'Overdue': 'متأخر',
    'Today': 'اليوم',
    'This Week': 'هذا الأسبوع',
    'This Month': 'هذا الشهر',

    // ── Deal stages ──────────────────────────────────────────────────────────
    'Lead': 'عميل محتمل',
    'Qualified': 'مؤهل',
    'Proposal': 'عرض سعر',
    'Negotiation': 'تفاوض',
    'Won': 'مكسوبة',
    'Lost': 'خسارة',
    'Kanban': 'كانبان',
    'List': 'قائمة',

    // ── Dashboard ────────────────────────────────────────────────────────────
    'Total Contacts': 'إجمالي جهات الاتصال',
    'Total Companies': 'إجمالي الشركات',
    'Open Deals': 'الصفقات المفتوحة',
    'Activities Due': 'الأنشطة المستحقة',
    'Pipeline Value': 'قيمة خط الأعمال',
    'Recent Activity': 'النشاط الأخير',
    'Sales Performance': 'أداء المبيعات',
    'Goals': 'الأهداف',
    'Revenue Target': 'هدف الإيرادات',
    'Deals Target': 'هدف الصفقات',
    'Activities Target': 'هدف الأنشطة',
    'Set Goals': 'تحديد الأهداف',
    'No recent activity': 'لا يوجد نشاط حديث',

    // ── Page headings ────────────────────────────────────────────────────────
    'User Management': 'إدارة المستخدمين',
    'Dynamic Lists': 'القوائم الديناميكية',
    'Sales performance & activity analytics': 'تحليلات الأداء والنشاط',
    'Activity schedule & upcoming tasks': 'جدول الأنشطة والمهام القادمة',
    'Manage dropdown options used across the CRM': 'إدارة خيارات القوائم المنسدلة',
    'Your sales team overview': 'نظرة عامة على فريق المبيعات',

    // ── Form field labels ─────────────────────────────────────────────────────
    'First Name': 'الاسم الأول',
    'Last Name': 'اسم العائلة',
    'Email': 'البريد الإلكتروني',
    'Phone': 'الهاتف',
    'Title': 'المسمى الوظيفي',
    'Status': 'الحالة',
    'Name': 'الاسم',
    'Company': 'الشركة',
    'Notes': 'ملاحظات',
    'Industry': 'الصناعة',
    'Website': 'الموقع الإلكتروني',
    'Address': 'العنوان',
    'City': 'المدينة',
    'Country': 'الدولة',
    'Value': 'القيمة',
    'Stage': 'المرحلة',
    'Source': 'المصدر',
    'Type': 'النوع',
    'Date': 'التاريخ',
    'Due Date': 'تاريخ الاستحقاق',
    'Description': 'الوصف',
    'Details': 'التفاصيل',
    'Lead Status': 'حالة العميل',
    'Assigned to': 'مُعيَّن لـ',
    'Assigned': 'المسؤول',
    'Category': 'الفئة',
    'Role': 'الدور',
    'PIN': 'الرقم السري',
    'Folder': 'المجلد',
    'Custom ID': 'المعرف المخصص',
    'Probability': 'الاحتمالية',
    'Close Date': 'تاريخ الإغلاق',
    'Contact': 'جهة الاتصال',
    'Deal': 'الصفقة',
    'Activity': 'النشاط',
    'Task': 'المهمة',
    'Subject': 'الموضوع',
    'Message': 'الرسالة',
    'Size': 'الحجم',
    'Revenue': 'الإيرادات',
    'manager': 'مدير',
    'sales': 'مبيعات',

    // ── Table headers ─────────────────────────────────────────────────────────
    'Actions': 'إجراءات',
    'Created': 'تاريخ الإنشاء',
    'Updated': 'تاريخ التحديث',
    'Last Activity': 'آخر نشاط',
    'Contacts': 'جهات الاتصال',
    'Deals': 'الصفقات',

    // ── Empty states ─────────────────────────────────────────────────────────
    'No contacts found': 'لا توجد جهات اتصال',
    'No companies found': 'لا توجد شركات',
    'No deals found': 'لا توجد صفقات',
    'No activities found': 'لا توجد أنشطة',
    'No tasks found': 'لا توجد مهام',
    'No reminders': 'لا توجد تذكيرات',
    'No users found': 'لا يوجد مستخدمون',
    'Select a contact': 'اختر جهة اتصال',
    'Select a company': 'اختر شركة',
    'Add your first deal to get started': 'أضف صفقتك الأولى للبدء',
    'Add an activity to stay on track': 'أضف نشاطاً للبقاء على المسار',
    'Add a task to get started': 'أضف مهمة للبدء',
    'Set a reminder when creating an activity or task': 'حدد تذكيراً عند إنشاء نشاط أو مهمة',
    'Loading...': 'جاري التحميل...',
    'Loading': 'جاري التحميل',
    'No data': 'لا توجد بيانات',
    'Failed to load': 'فشل التحميل',

    // ── Confirm dialogs ──────────────────────────────────────────────────────
    'This cannot be undone.': 'لا يمكن التراجع عن هذا الإجراء.',
    'Confirm Delete': 'تأكيد الحذف',
    'Are you sure?': 'هل أنت متأكد؟',
    'Delete this task?': 'حذف هذه المهمة؟',

    // ── Toast messages ───────────────────────────────────────────────────────
    'Contact added': 'تمت إضافة جهة الاتصال',
    'Contact updated': 'تم تحديث جهة الاتصال',
    'Contact deleted': 'تم حذف جهة الاتصال',
    'Company added': 'تمت إضافة الشركة',
    'Company updated': 'تم تحديث الشركة',
    'Company deleted': 'تم حذف الشركة',
    'Deal added': 'تمت إضافة الصفقة',
    'Deal updated': 'تم تحديث الصفقة',
    'Deal deleted': 'تم حذف الصفقة',
    'Activity added': 'تمت إضافة النشاط',
    'Activity updated': 'تم تحديث النشاط',
    'Activity deleted': 'تم حذف النشاط',
    'Task added': 'تمت إضافة المهمة',
    'Task updated': 'تم تحديث المهمة',
    'Task deleted': 'تم حذف المهمة',
    'Saved': 'تم الحفظ',
    'Deleted': 'تم الحذف',
    'Copied!': 'تم النسخ!',
    'Exported successfully': 'تم التصدير بنجاح',
    'Status updated': 'تم تحديث الحالة',
    'Reminder set': 'تم تعيين التذكير',
    'Goal saved': 'تم حفظ الهدف',
    'Merged successfully': 'تم الدمج بنجاح',

    // ── Activity types ───────────────────────────────────────────────────────
    'Call': 'مكالمة',
    'Meeting': 'اجتماع',
    'Email': 'بريد إلكتروني',
    'Note': 'ملاحظة',
    'Visit': 'زيارة',
    'Task': 'مهمة',
  };

  // ── Core functions ──────────────────────────────────────────────────────────

  function getLang() { return localStorage.getItem('crm_lang') || 'en'; }

  function t(key) {
    if (!key) return key;
    if (getLang() === 'ar' && AR[key]) return AR[key];
    return key;
  }

  function applyDir() {
    const ar = getLang() === 'ar';
    document.documentElement.dir = ar ? 'rtl' : 'ltr';
    document.documentElement.lang = ar ? 'ar' : 'en';
    document.body.classList.toggle('rtl', ar);
  }

  function applyDataAttrs(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    (root || document).querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPh);
    });
    (root || document).querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.dataset.i18nTitle);
    });
  }

  // Translate a single text node
  function translateNode(node) {
    if (getLang() !== 'ar') return;
    const raw = node.textContent;
    const trimmed = raw.trim();
    if (trimmed && AR[trimmed]) {
      node.textContent = raw.replace(trimmed, AR[trimmed]);
    }
  }

  // Walk element subtree and translate all text nodes
  function translateSubtree(root) {
    if (getLang() !== 'ar') return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const tag = node.parentElement && node.parentElement.tagName;
        if (!tag || ['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'OPTION'].includes(tag)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(translateNode);
  }

  // MutationObserver: translate new content as JS renders it
  let _observer = null;
  function startObserver() {
    if (_observer) return;
    _observer = new MutationObserver(mutations => {
      if (getLang() !== 'ar') return;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            applyDataAttrs(node);
            translateSubtree(node);
          } else if (node.nodeType === Node.TEXT_NODE) {
            translateNode(node);
          }
        }
      }
    });
    _observer.observe(document.body, { childList: true, subtree: true });
  }

  function updateLangBtn() {
    const btn = document.getElementById('langToggleBtn');
    if (btn) btn.textContent = getLang() === 'ar' ? 'EN' : 'عر';
  }

  function apply() {
    applyDir();
    applyDataAttrs();
    if (getLang() === 'ar') translateSubtree(document.body);
    startObserver();
    updateLangBtn();
  }

  function toggle() {
    const next = getLang() === 'ar' ? 'en' : 'ar';
    localStorage.setItem('crm_lang', next);
    // Reload page so all JS-rendered content re-renders in new language
    location.reload();
  }

  // Apply direction immediately to avoid layout flash
  applyDir();

  // Expose globally
  window.I18N = { t, apply, toggle, getLang, applyDataAttrs, translateSubtree };
  window.t = t;

})();
