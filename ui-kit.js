(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHtml = value => window.FamilyHub?.escapeHtml
    ? window.FamilyHub.escapeHtml(value)
    : String(value ?? '').replace(/[&<>'"]/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
      })[character]);

  function openModal({ title, body, footer = '', closeAttribute = 'data-modal-close', className = '' }) {
    const dialog = $('#manageDialog');
    const form = $('#manageForm');
    if (!dialog || !form) throw new Error('管理弹窗尚未初始化');
    form.innerHTML = `<div class="modal ${escapeHtml(className)}"><header><h2>${escapeHtml(title)}</h2><button type="button" class="close" ${closeAttribute}>×</button></header><div class="manage-body">${body}</div>${footer ? `<footer>${footer}</footer>` : ''}</div>`;
    if (dialog.open) dialog.close();
    dialog.showModal();
  }

  function closeModal() {
    const dialog = $('#manageDialog');
    if (dialog?.open) dialog.close();
  }

  function download(name, content, type = 'application/json') {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function report(error) {
    alert(error instanceof Error ? error.message : String(error || '操作失败'));
  }

  window.FamilyHubUI = Object.freeze({ $, $$, escapeHtml, openModal, closeModal, download, report });
})();
