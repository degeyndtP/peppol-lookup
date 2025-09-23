'use strict';
(function(){
  const I18n = {
    current: 'en',
    dict: {},
    supported: ['en','nl','fr'],
    t(key, vars={}){
      let s = (I18n.dict[key] !== undefined) ? I18n.dict[key] : key;
      Object.keys(vars).forEach(k => {
        s = s.replace(new RegExp('\\{\\{'+k+'\\}\\}','g'), String(vars[k]));
      });
      return s;
    },
    async load(lang){
      if (!I18n.supported.includes(lang)) lang = 'en';
      I18n.current = lang;
      try {
        const res = await fetch(`i18n/${lang}.json`);
        I18n.dict = await res.json();
      } catch(e){
        console.warn('i18n load failed, falling back to en', e);
        if (lang !== 'en') return I18n.load('en');
      }
      I18n.applyTranslations();
    },
    applyTranslations(){
      // Set HTML lang attribute
      if (document?.documentElement) {
        document.documentElement.setAttribute('lang', I18n.current);
      }
      // Text content
      document.querySelectorAll('[data-i18n]')?.forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = I18n.t(key);
      });
      // Placeholders
      document.querySelectorAll('[data-i18n-placeholder]')?.forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.setAttribute('placeholder', I18n.t(key));
      });
      // Title tag
      if (document && document.title) {
        document.title = I18n.t('title');
      }
      // Footer composite example
      const footerPre = document.querySelector('[data-i18n-footer-pre]');
      const footerPost = document.querySelector('[data-i18n-footer-post]');
      if (footerPre) footerPre.textContent = I18n.t('footer_text_pre');
      if (footerPost) footerPost.textContent = I18n.t('footer_text_post');
      // Button text (if using span inside)
      const btnText = document.getElementById('btnText');
      if (btnText) btnText.textContent = I18n.t('lookup_button');

      // Emit event to allow dynamic components to re-render
      document.dispatchEvent(new CustomEvent('i18n:applied', { detail: { lang: I18n.current } }));
    },
    async setLanguage(lang){
      localStorage.setItem('lang', lang);
      await I18n.load(lang);
    },
    init(){
      const stored = localStorage.getItem('lang');
      let lang = stored || (navigator.language || 'en').slice(0,2).toLowerCase();
      if (!I18n.supported.includes(lang)) lang = 'en';
      // Initialize switcher
      const sel = document.getElementById('langSwitcher');
      if (sel) sel.value = lang;
      I18n.load(lang);
    }
  };

  window.I18n = I18n;
  document.addEventListener('DOMContentLoaded', () => {
    // Attach change handler for language switcher
    const sel = document.getElementById('langSwitcher');
    if (sel) {
      sel.addEventListener('change', (e) => I18n.setLanguage(e.target.value));
    }
    I18n.init();
  });
})();
