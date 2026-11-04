const faqEntries = window.TANYASAMBUTAN_FAQS;
const englishLocale = window.TANYASAMBUTAN_EN;
const categories = [
  { id: 'surat', name: 'Surat & Dokumen', icon: '▤' },
  { id: 'penduduk', name: 'Kependudukan', icon: '♙' },
  { id: 'sosial', name: 'Bantuan Sosial', icon: '♡' },
  { id: 'aduan', name: 'Aduan', icon: '▱' },
  { id: 'lainnya', name: 'Lainnya', icon: '•••' }
];

const conversation = document.querySelector('#conversation');
const categoryList = document.querySelector('#category-list');
const answerArea = document.querySelector('#answer-area');
const questionForm = document.querySelector('#question-form');
const questionInput = document.querySelector('#question-input');
const statusTitle = document.querySelector('#status-title');
const statusDot = document.querySelector('.status-dot');
let currentLanguage = 'id';
const quickActionLabels = {
  steps: 'Lihat alur',
  requirements: 'Dokumen apa saja?',
  costDuration: 'Biaya & waktu',
  askMore: 'Tanya hal lain',
  staff: 'Tanya petugas'
};
let isResponding = false;

function localizedText(key, fallback = '') {
  if (currentLanguage !== 'en') return fallback;
  return key.split('.').reduce((value, part) => value?.[part], englishLocale.ui) || fallback;
}

function localizeFaq(faq) {
  if (currentLanguage !== 'en') return faq;
  return { ...faq, ...(englishLocale.faqs[faq.id] || {}) };
}

function actionLabel(type) {
  const keys = {
    steps: 'actions.steps',
    requirements: 'actions.requirements',
    costDuration: 'actions.costDuration',
    askMore: 'actions.askMore',
    staff: 'actions.staff'
  };
  return localizedText(keys[type] || '', quickActionLabels[type] || '');
}

function whatsappUrl() {
  const message = localizedText('actions.waPrefill', 'Halo, saya ingin bertanya kepada Kecamatan Sambutan.');
  return `https://wa.me/6285172298564?text=${encodeURIComponent(message)}`;
}

function updateContactLinks() {
  document.querySelectorAll('#staff-status, #help-link, a[data-contact-link]').forEach(link => {
    link.href = whatsappUrl();
  });
}

function isStaffOnline() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Makassar',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());
  const weekday = parts.find(part => part.type === 'weekday')?.value;
  const hour = Number(parts.find(part => part.type === 'hour')?.value);
  const minute = Number(parts.find(part => part.type === 'minute')?.value);
  const currentMinutes = hour * 60 + minute;
  const closingTime = weekday === 'Fri' ? 15 * 60 : 16 * 60;
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday)
    && currentMinutes >= 8 * 60
    && currentMinutes < closingTime;
}

function refreshStaffStatus() {
  const online = isStaffOnline();
  statusTitle.textContent = online
    ? localizedText('statusOnline', 'Petugas online')
    : localizedText('statusOffline', 'Di luar jam layanan');
  statusDot.classList.toggle('offline', !online);
  statusDot.parentElement.classList.toggle('offline', !online);
}

function normalize(text) {
  return text.toLocaleLowerCase('id-ID')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findFaq(query) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return null;

  const terms = normalizedQuery.split(' ').filter(term => term.length > 1);
  let bestMatch = null;
  let bestScore = 0;

  for (const faq of faqEntries) {
    const translated = englishLocale.faqs[faq.id];
    const keywords = [...faq.keywords, ...(translated?.keywords || [])].map(normalize);
    let score = keywords.reduce((total, keyword) => {
      if (normalizedQuery === keyword) return total + 8;
      if (normalizedQuery.includes(keyword)) return total + 6;
      if (terms.some(term => keyword === term)) return total + 4;
      if (terms.some(term => keyword.includes(term))) return total + 2;
      return total;
    }, 0);
    if (normalizedQuery === normalize(faq.question)
      || (translated && normalizedQuery === normalize(translated.question))) score += 10;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = faq;
    }
  }
  return bestScore >= 2 ? bestMatch : null;
}

function scrollToLatest(target = answerArea.lastElementChild) {
  if (!target) return;
  requestAnimationFrame(() => {
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
      inline: 'nearest'
    });
  });
}

function appendUserMessage(text) {
  const row = document.createElement('div');
  row.className = 'user-query';
  const message = document.createElement('span');
  message.textContent = text;
  row.append(message);
  answerArea.append(row);
  scrollToLatest(row);
}

function appendBotMessage({ text, list, listOrdered = true, actions, showCategories = false } = {}) {
  const row = document.createElement('div');
  row.className = 'message-row bot-row';
  const avatar = document.createElement('span');
  avatar.className = 'avatar bot-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = 'T';

  const content = document.createElement('div');
  content.className = 'message-content';
  const sender = document.createElement('span');
  sender.className = 'sender-name';
  sender.textContent = `${localizedText('assistantName', 'TanyaSambutan')} ${localizedText('assistantRole', '· Asisten virtual')}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble welcome-bubble';

  if (text) {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    bubble.append(paragraph);
  }
  if (list) {
    const ordered = document.createElement(listOrdered ? 'ol' : 'ul');
    list.forEach(item => {
      const listItem = document.createElement('li');
      listItem.textContent = item;
      ordered.append(listItem);
    });
    bubble.append(ordered);
  }
  if (actions?.length) {
    const actionList = document.createElement('div');
    actionList.className = 'answer-actions quick-actions';
    actions.forEach(({ faqId, type, label }) => {
      actionList.append(makeAction(faqId, type, label));
    });
    bubble.append(actionList);
  }
  if (showCategories) {
    const choices = document.createElement('div');
    choices.className = 'category-list';
    renderCategories(choices);
    bubble.append(choices);
  }

  content.append(sender, bubble);
  row.append(avatar, content);
  answerArea.append(row);
  scrollToLatest(row);
  return row;
}

function appendTypingIndicator() {
  const row = appendBotMessage({ text: localizedText('actions.typing', 'Mengetik…') });
  row.classList.add('typing-indicator');
  return row;
}

function createField(title, icon, content, fullWidth = false, ordered = false) {
  const field = document.createElement('section');
  field.className = `answer-field${fullWidth ? ' full-width' : ''}`;
  const heading = document.createElement('h4');
  const iconElement = document.createElement('span');
  iconElement.className = 'field-icon';
  iconElement.textContent = icon;
  heading.append(iconElement, document.createTextNode(title));
  field.append(heading);

  if (Array.isArray(content)) {
    const list = document.createElement(ordered ? 'ol' : 'ul');
    content.forEach(item => {
      const listItem = document.createElement('li');
      listItem.textContent = item;
      list.append(listItem);
    });
    field.append(list);
  } else {
    const paragraph = document.createElement('p');
    paragraph.textContent = content;
    field.append(paragraph);
  }
  return field;
}

function renderFaqCard(faq) {
  const card = createFaqCard(faq);
  answerArea.append(card);
  renderRelated(faq);
  scrollToLatest(card);
}

function createFaqCard(faq) {
  const content = localizeFaq(faq);
  const card = document.createElement('article');
  card.className = 'answer-card';
  card.dataset.faqId = faq.id;

  const heading = document.createElement('div');
  heading.className = 'answer-heading';
  const titleGroup = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = content.question;
  const summary = document.createElement('p');
  summary.textContent = content.summary;
  titleGroup.append(title, summary);

  const verification = document.createElement('span');
  verification.className = 'verified-label';
  verification.textContent = content.verification_status === 'TERKONFIRMASI'
    ? localizedText('actions.confirmed', content.verification_status)
    : localizedText('actions.verified', content.verification_status);
  heading.append(titleGroup, verification);

  const body = document.createElement('div');
  body.className = 'answer-body';
  body.append(
    createField(localizedText('actions.fields.requirements', 'Syarat dokumen'), '▤', content.requirements, true),
    createField(localizedText('actions.fields.steps', 'Alur singkat'), '↻', content.steps, false, true),
    createField(localizedText('actions.fields.cost', 'Biaya'), 'Rp', content.cost),
    createField(localizedText('actions.fields.duration', 'Estimasi waktu'), '◷', content.duration),
    createField(localizedText('actions.fields.location', 'Lokasi / loket'), '⌖', content.location, true)
  );

  const meta = document.createElement('div');
  meta.className = 'answer-meta';
  const updated = document.createElement('span');
  updated.textContent = `${localizedText('actions.lastUpdated', 'Terakhir diperbarui')}: ${content.updated_at}`;
  const sourceNotice = document.createElement('span');
  sourceNotice.textContent = localizedText('actions.sourceNotice', 'Konfirmasi ke kanal resmi sebelum mengurus');
  meta.append(updated, sourceNotice);

  const actions = document.createElement('div');
  actions.className = 'answer-actions';
  if (faq.external_url) {
    const laporLink = document.createElement('a');
    laporLink.className = 'action-chip primary';
    laporLink.href = faq.external_url;
    laporLink.target = '_blank';
    laporLink.rel = 'noopener noreferrer';
    laporLink.textContent = localizedText('actions.lapor', 'Buka LAPOR! ↗');
    actions.append(laporLink);
  }
  actions.append(
    makeAction(faq.id, 'steps', actionLabel('steps')),
    makeAction(faq.id, 'requirements', actionLabel('requirements')),
    makeAction(faq.id, 'costDuration', actionLabel('costDuration')),
    makeAction(faq.id, 'askMore', actionLabel('askMore')),
    makeAction(faq.id, 'staff', actionLabel('staff'), true)
  );
  card.append(heading, body, meta, actions);
  return card;
}

function makeAction(faqId, type, label, primary = false) {
  if (type === 'staff') {
    const link = document.createElement('a');
    link.className = `action-chip${primary ? ' primary' : ''}`;
    link.dataset.contactLink = 'true';
    link.href = whatsappUrl();
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label;
    return link;
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `action-chip${primary ? ' primary' : ''}`;
  button.dataset.faqId = faqId;
  button.dataset.actionType = type;
  button.textContent = label;
  return button;
}

function renderRelated(faq) {
  const relatedFaqs = faq.related
    .map(id => faqEntries.find(entry => entry.id === id))
    .filter(Boolean);
  if (!relatedFaqs.length) return;

  const relatedArea = document.createElement('section');
  relatedArea.className = 'related-area';
  const title = document.createElement('p');
  title.className = 'related-title';
  title.textContent = localizedText('actions.relatedTitle', 'MUNGKIN KAMU JUGA INGIN TAHU');
  const list = document.createElement('div');
  list.className = 'related-list';
  relatedFaqs.forEach(relatedFaq => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'related-question';
    button.dataset.faqId = relatedFaq.id;
    button.dataset.actionType = 'related';
    button.textContent = localizeFaq(relatedFaq).question;
    list.append(button);
  });
  relatedArea.append(title, list);
  answerArea.append(relatedArea);
}

function showTypingDelay() {
  return new Promise(resolve => window.setTimeout(resolve, 600));
}

function setBusy(isBusy) {
  isResponding = isBusy;
  conversation.querySelectorAll('button[data-action-type], button[data-category]').forEach(button => {
    button.disabled = isBusy;
  });
}

async function handleQuickAction(faqId, actionType, label) {
  if (isResponding) return;
  const faq = faqEntries.find(entry => entry.id === faqId);
  if (!faq) return;
  const userText = label || actionLabel(actionType) || localizeFaq(faq).question;

  setBusy(true);
  appendUserMessage(userText);

  if (actionType === 'askMore') {
    appendBotMessage({ text: localizedText('actions.askAgain', 'Mau tanya apa lagi?'), showCategories: true });
    setBusy(false);
    return;
  }

  const typing = appendTypingIndicator();
  await showTypingDelay();
  typing.remove();
  const content = localizeFaq(faq);

  if (actionType === 'steps') {
    appendBotMessage({
      list: content.steps,
      actions: [
        { faqId, type: 'requirements', label: actionLabel('requirements') },
        { faqId, type: 'costDuration', label: actionLabel('costDuration') },
        { faqId, type: 'staff', label: actionLabel('staff') }
      ]
    });
  } else if (actionType === 'requirements') {
    appendBotMessage({ list: content.requirements, listOrdered: false });
  } else if (actionType === 'costDuration') {
    appendBotMessage({
      text: `${localizedText('actions.fields.cost', 'Biaya')}: ${content.cost} ${localizedText('actions.fields.duration', 'Estimasi waktu')}: ${content.duration}`
    });
  } else if (actionType === 'related') {
    renderFaqCard(faq);
  } else if (actionType === 'staff') {
    showStaffChat();
  }

  setBusy(false);
}

function showStaffChat() {
  const online = isStaffOnline();
  appendBotMessage({
    text: online
      ? localizedText('actions.staffOnline', 'Petugas sedang online sesuai jam layanan. Hubungi Kecamatan melalui WhatsApp resmi di bawah.')
      : localizedText('actions.staffOffline', 'Petugas sedang di luar jam layanan. Kamu tetap dapat mengirim pesan WhatsApp; pesan akan ditangani saat jam layanan.')
  });
  const link = document.createElement('a');
  link.className = 'action-chip primary';
  link.dataset.contactLink = 'true';
  link.href = whatsappUrl();
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = actionLabel('staff');
  answerArea.lastElementChild.querySelector('.bubble').append(link);
  scrollToLatest();
}

function renderNotFound(question) {
  appendUserMessage(question);
  appendBotMessage({
    text: localizedText('actions.notFound', 'Maaf, aku belum menemukan jawaban yang cocok. Coba kata kunci lain, pilih topik, atau tanyakan kepada petugas.'),
    actions: [{ faqId: faqEntries[0].id, type: 'staff', label: actionLabel('staff') }]
  });
}

function handleQuestion(question) {
  const faq = findFaq(question);
  appendUserMessage(question);
  questionInput.placeholder = localizedText('inputPlaceholder', 'Ketik pertanyaanmu di sini...');
  if (faq) renderFaqCard(faq);
  else appendBotMessage({
    text: localizedText('actions.unknown', 'Aku belum menemukan jawaban yang cocok. Coba pilih kategori topik di atas atau gunakan kata kunci lain.')
  });
}

function renderCategories(container = categoryList) {
  categories.forEach(category => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-chip';
    button.dataset.category = category.id;
    button.setAttribute('aria-pressed', 'false');
    const icon = document.createElement('span');
    icon.className = 'category-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = category.icon;
    const categoryName = localizedText(`categories.${category.id}`, category.name);
    button.append(icon, document.createTextNode(categoryName));
    container.append(button);
  });
}

function handleCategory(categoryId) {
  const faq = faqEntries.find(entry => entry.category === categoryId);
  if (!faq) return;
  categoryList.querySelectorAll('.category-chip').forEach(button => {
    const selected = button.dataset.category === categoryId;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  handleQuestion(localizeFaq(faq).question);
}

conversation.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target.closest('button') : null;
  if (!target || isResponding) return;

  if (target.dataset.actionType) {
    handleQuickAction(target.dataset.faqId, target.dataset.actionType, target.textContent.trim());
  } else if (target.dataset.category) {
    handleCategory(target.dataset.category);
  }
});

questionForm.addEventListener('submit', event => {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question || isResponding) {
    questionInput.focus();
    return;
  }
  handleQuestion(question);
  questionInput.value = '';
  questionInput.focus();
});

function applyLanguage(language) {
  currentLanguage = language;
  document.documentElement.lang = language;
  document.querySelector('#page-description').content = localizedText(
    'metaDescription',
    'Pusat FAQ interaktif dan chat petugas Kecamatan Sambutan.'
  );
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.dataset.i18n;
    if (!element.dataset.defaultText) element.dataset.defaultText = element.textContent.trim();
    const translation = localizedText(key, element.dataset.defaultText);
    const icon = element.querySelector('[aria-hidden="true"]');
    if (icon) {
      element.textContent = translation;
      element.append(icon);
    } else {
      element.textContent = translation;
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    if (!element.dataset.defaultPlaceholder) element.dataset.defaultPlaceholder = element.placeholder;
    element.placeholder = localizedText(element.dataset.i18nPlaceholder, element.dataset.defaultPlaceholder);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(element => {
    if (!element.dataset.defaultAria) element.dataset.defaultAria = element.getAttribute('aria-label');
    element.setAttribute('aria-label', localizedText(element.dataset.i18nAria, element.dataset.defaultAria));
  });
  document.querySelectorAll('.language-toggle [data-language]').forEach(button => {
    const selected = button.dataset.language === language;
    button.classList.toggle('language-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  document.querySelectorAll('.category-chip[data-category]').forEach(button => {
    const category = categories.find(item => item.id === button.dataset.category);
    if (category) button.lastChild.textContent = localizedText(`categories.${category.id}`, category.name);
  });
  answerArea.querySelectorAll('.answer-card[data-faq-id]').forEach(card => {
    const faq = faqEntries.find(entry => entry.id === card.dataset.faqId);
    if (faq) card.replaceWith(createFaqCard(faq));
  });
  answerArea.querySelectorAll('.related-area').forEach(area => {
    area.querySelector('.related-title').textContent = localizedText('actions.relatedTitle', 'MUNGKIN KAMU JUGA INGIN TAHU');
    area.querySelectorAll('.related-question[data-faq-id]').forEach(button => {
      const faq = faqEntries.find(entry => entry.id === button.dataset.faqId);
      if (faq) button.textContent = localizeFaq(faq).question;
    });
  });
  answerArea.querySelectorAll('button[data-action-type]:not([data-action-type="related"])').forEach(button => {
    button.textContent = actionLabel(button.dataset.actionType);
  });
  answerArea.querySelectorAll('a[data-contact-link]').forEach(link => {
    link.textContent = actionLabel('staff');
  });
  updateContactLinks();
  refreshStaffStatus();
}

document.querySelector('.language-toggle').addEventListener('click', event => {
  const button = event.target.closest('[data-language]');
  if (button) applyLanguage(button.dataset.language);
});
renderCategories();
updateContactLinks();
refreshStaffStatus();
window.setInterval(refreshStaffStatus, 60_000);
