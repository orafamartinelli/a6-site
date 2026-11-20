(function () {
  "use strict";

  const CRM_API_URL = 'https://orafamartinelli.com.br/crm/api/leads';

  // Grupo de avisos "Viva Superia - Próximas Edições" (só admins postam).
  // Grupo do WhatsApp lota em 1.024 participantes: quando isso acontecer,
  // basta trocar este link pelo convite do grupo novo.
  // LINK FIXO (02/11/2026): a página grupo.html pergunta ao robô A6 qual grupo tem vaga — NÃO trocar quando um
  // grupo enche. Sem barra no fim (com barra cai no 404).
  const WA_GROUP_URL = 'https://orafamartinelli.com.br/vivasuperia/grupo';

  function getCanalOrigem() {
    const medium = new URLSearchParams(location.search).get('utm_medium') ?? '';
    if (medium === 'paid') return 'paid_social';
    if (medium === 'organic' || document.referrer.includes('google.com')) return 'organico';
    if (!document.referrer) return 'direto';
    return 'outros';
  }

  function getUtms() {
    const p = new URLSearchParams(location.search);
    return {
      utm_source:   p.get('utm_source') ?? undefined,
      utm_medium:   p.get('utm_medium') ?? undefined,
      utm_campaign: p.get('utm_campaign') ?? undefined,
      utm_content:  p.get('utm_content') ?? undefined,
      utm_term:     p.get('utm_term') ?? undefined,
      fbclid:       p.get('fbclid') ?? undefined,
    };
  }

  // Página + sessão do kit rastreio-lp.js — vai no payload do CRM (raw_payload) para comparar páginas.
  function getRastreio() {
    const r = window.RastreioLP || {};
    return {
      pagina:    r.pagina || (location.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/'),
      sessao_lp: r.sessao || undefined,
    };
  }

  // Reads the _fbp cookie (set by the Meta pixel) so the server-side CAPI Lead
  // can match the same browser. Absent when fbevents.js was blocked — that's fine.
  function getFbp() {
    const m = document.cookie.match(/(?:^|;\s*)_fbp=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : undefined;
  }

  async function submitToCRM_orcamento(formData) {
    const payload = {
      tipo:           'form_orcamento',
      meta_event_id:  formData.meta_event_id,
      fbp:            formData.fbp,
      nome_completo:  formData.nome,
      telefone:       formData.celular_e164 || formData.celular,
      email:          formData.email,
      cidade:         formData.cidade,
      numero_pessoas: formData.pessoas ?? formData.numero_pessoas,
      opt_in:         !!formData.opt_in,
      evento_slug:    'recanto-novembro-2026',
      device:         /Mobi/.test(navigator.userAgent) ? 'smartphone' : 'desktop',
      canal_origem:   getCanalOrigem(),
      ...getUtms(),
      ...getRastreio(),
    };
    try {
      await fetch(CRM_API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
    } catch (e) {
      console.error('CRM submit failed', e);
      // Don't block the UX — just log
    }
  }

  async function submitToCRM_espera(formData) {
    const payload = {
      tipo:              'form_lista_espera',
      meta_event_id:     formData.meta_event_id,
      fbp:               formData.fbp,
      nome_completo:     formData.nome,
      telefone:          formData.celular,
      email:             formData.email,
      resorts_interesse:  formData.resorts ?? [],
      artistas_interesse: [
        formData.artista_1 === 'outro' ? (formData.artista_1_outro || '').trim() : formData.artista_1,
        formData.artista_2 === 'outro' ? (formData.artista_2_outro || '').trim() : formData.artista_2,
      ].filter(Boolean),
      sugestoes:          formData.sugestoes || null,
      opt_in:             true,
      device:             /Mobi/.test(navigator.userAgent) ? 'smartphone' : 'desktop',
      canal_origem:       getCanalOrigem(),
      ...getUtms(),
      ...getRastreio(),
    };
    try {
      await fetch(CRM_API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
    } catch (e) {
      console.error('CRM submit failed', e);
    }
  }

  // === MODAL ===
  const VS_Modal = (function() {
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';
    let lastFocusedTrigger = null;
    let activeModal = null;

    function open(id, trigger) {
      const modal = document.getElementById(`modal-${id}`);
      if (!modal) return;
      if (activeModal && activeModal !== modal) close();
      lastFocusedTrigger = trigger || document.activeElement;
      activeModal = modal;
      modal.hidden = false;
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => {
        const focusables = modal.querySelectorAll(FOCUSABLE);
        if (focusables.length) focusables[0].focus();
      });
      return modal;
    }
    function close() {
      if (!activeModal) return;
      activeModal.dispatchEvent(new CustomEvent("modal:closed"));
      activeModal.hidden = true;
      document.body.style.overflow = "";
      if (lastFocusedTrigger) lastFocusedTrigger.focus();
      activeModal = null;
    }

    document.addEventListener("click", e => {
      const trigger = e.target.closest("[data-modal-open]");
      if (trigger) {
        e.preventDefault();
        const id = trigger.dataset.modalOpen;
        const modal = open(id, trigger);
        if (modal) modal.dispatchEvent(new CustomEvent("modal:opened", { detail: { trigger } }));
        return;
      }
      if (e.target.closest("[data-modal-close]")) {
        e.preventDefault();
        close();
      }
    });
    // Enter/Space on role="button" elements (gallery cells, video cards) should trigger click.
    // Native <button> already does this; <div role="button"> and <article role="button"> do not.
    document.addEventListener("keydown", e => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const el = e.target.closest('[role="button"][tabindex="0"]');
      if (!el) return;
      // Skip native form/button elements that already handle this themselves.
      const tag = el.tagName;
      if (tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      e.preventDefault();
      el.click();
    });
    document.addEventListener("keydown", e => {
      if (!activeModal) return;
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const focusables = Array.from(activeModal.querySelectorAll(FOCUSABLE));
        if (!focusables.length) return;
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    return { open, close };
  })();

  // === VIDEOS GRID RENDER ===
  (function() {
    const grid = document.querySelector("[data-videos-grid]");
    if (!grid || !window.VS_DATA?.videos) return;
    grid.innerHTML = window.VS_DATA.videos.map(v => {
      const thumbSrc = v.customThumb || `https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg`;
      const onerror = v.customThumb ? "" : `onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${v.id}/hqdefault.jpg'"`;
      return `
      <article class="video-card" data-modal-open="video" data-video-id="${v.id}" tabindex="0" role="button" aria-label="Assistir ${v.title}">
        <img loading="lazy" decoding="async" width="480" height="360" src="${thumbSrc}" alt="${v.title}" ${onerror}>
        <div class="video-card__overlay">
          <div class="video-card__edition">${v.edition}</div>
          <div class="video-card__play" aria-hidden="true">▶</div>
          <div class="video-card__title">${v.title}</div>
        </div>
      </article>
    `;
    }).join("");
  })();

  // === TESTIMONIALS RENDER ===
  (function() {
    const strip = document.querySelector("[data-testimonials-strip]");
    if (!strip || !window.VS_DATA?.testimonials) return;
    strip.innerHTML = window.VS_DATA.testimonials.map(t => `
      <article class="phone" role="listitem">
        <div class="phone__header">
          <div class="phone__name">${t.name}</div>
          <div class="phone__phone">${t.phone}</div>
        </div>
        <div class="phone__messages">
          ${t.messages.map(m => `
            <div class="bubble bubble--${m.from === 'user' ? 'user' : 'agency'}">
              ${m.text}
              <div class="bubble__time">${m.time}</div>
            </div>
          `).join("")}
        </div>
        <div class="phone__edition-tag">${t.edition}</div>
      </article>
    `).join("");
  })();

  // === GALLERY RENDER ===
  (function() {
    const tabsEl = document.querySelector("[data-gallery-tabs]");
    const panelEl = document.querySelector("[data-gallery-panel]");
    if (!tabsEl || !panelEl || !window.VS_DATA?.gallery) return;

    const editions = Object.entries(window.VS_DATA.gallery);
    if (!editions.length) return;
    let activeKey = editions[0][0];

    function render() {
      tabsEl.innerHTML = editions.map(([key, ed]) => `
        <button type="button" role="tab" class="gallery__tab" data-key="${key}" aria-selected="${key === activeKey}">${ed.label}</button>
      `).join("");

      const active = window.VS_DATA.gallery[activeKey];
      if (active.photos.length === 0) {
        panelEl.innerHTML = `
          <div class="gallery__empty">
            <span class="gallery__empty-icon">✦</span>
            <div class="gallery__empty-title">Álbum em organização</div>
            <p>As fotos desta edição serão liberadas em breve.</p>
          </div>`;
      } else {
        panelEl.innerHTML = `<div class="gallery__grid">` + active.photos.map((p, i) => `
          <div class="gallery__cell" data-modal-open="lightbox" data-edition="${activeKey}" data-index="${i}" role="button" tabindex="0" aria-label="${p.alt}">
            <img loading="lazy" decoding="async" width="800" height="800" src="${p.thumb}" alt="${p.alt}">
          </div>
        `).join("") + `</div>`;
      }
    }
    tabsEl.addEventListener("click", e => {
      const btn = e.target.closest(".gallery__tab");
      if (!btn) return;
      activeKey = btn.dataset.key;
      render();
    });
    render();
  })();

  // === PHONE INPUT (mask + country selector) ===
  function applyPhoneMask(digits, mask) {
    if (!mask) return digits;
    // OTHER country: mask is just "0...0" → no visual mask, only digits.
    const slots = (mask.match(/0/g) || []).length;
    const onlyDigits = digits.replace(/\D/g, "").slice(0, slots);
    // For "all zeros" mask (no separators), return raw digits.
    if (/^0+$/.test(mask)) return onlyDigits;
    let out = "";
    let di = 0;
    for (let i = 0; i < mask.length && di < onlyDigits.length; i++) {
      const c = mask[i];
      if (c === "0") {
        out += onlyDigits[di];
        di++;
      } else {
        out += c;
      }
    }
    return out;
  }

  // Brasil (02/11/2026): muita gente digita o "55" do país (ou um 0) antes do DDD — a máscara aceitava os
  // 11 primeiros dígitos e CORTAVA o fim do número (Recanto: 217 de 3.768 leads com telefone perdido).
  // Tira o 0 da frente sempre e o 55 quando passou de 11 dígitos (DDD 55 de verdade tem só 11).
  function normalizarBR(digits, slots) {
    let d = digits.replace(/\D/g, "").replace(/^0+/, "");
    if (d.length > slots && d.startsWith("55")) d = d.slice(2).replace(/^0+/, "");
    return d;
  }
  // Celular BR: DDD sem zero + 9 na frente do número.
  const celularBRValido = (d) => /^[1-9]{2}9\d{8}$/.test(d);

  function getPhoneContext(input) {
    const wrap = input.closest(".phone-input");
    if (!wrap) return null;
    const select = wrap.querySelector("[data-phone-country]");
    if (!select) return null;
    const opt = select.options[select.selectedIndex];
    const mask = opt?.dataset.mask || "";
    const dial = opt?.dataset.dial || "";
    const slots = (mask.match(/0/g) || []).length;
    return { wrap, select, opt, mask, dial, slots };
  }

  (function() {
    document.querySelectorAll("[data-phone-number]").forEach(input => {
      input.addEventListener("input", () => {
        const ctx = getPhoneContext(input);
        if (!ctx) return;
        const bruto = ctx.select.value === "BR" ? normalizarBR(input.value, ctx.slots) : input.value;
        const formatted = applyPhoneMask(bruto, ctx.mask);
        if (input.value !== formatted) {
          input.value = formatted;
          try { input.setSelectionRange(formatted.length, formatted.length); } catch (_) {}
        }
      });
    });

    document.querySelectorAll("[data-phone-country]").forEach(select => {
      select.addEventListener("change", () => {
        const wrap = select.closest(".phone-input");
        if (!wrap) return;
        const input = wrap.querySelector("[data-phone-number]");
        if (!input) return;
        const opt = select.options[select.selectedIndex];
        const mask = opt?.dataset.mask || "";
        const placeholder = opt?.dataset.placeholder;
        if (placeholder) input.placeholder = placeholder;
        const formatted = applyPhoneMask(input.value, mask);
        input.value = formatted;
      });
    });
  })();

  // === RESORTS "TODAS" CHECKBOX ===
  (function() {
    document.querySelectorAll("[data-resorts-group]").forEach(group => {
      const all = group.querySelector("[data-resorts-all]");
      const options = group.querySelectorAll("[data-resort-option]");
      if (!all || !options.length) return;

      all.addEventListener("change", () => {
        options.forEach(o => { o.checked = all.checked; });
      });

      options.forEach(opt => {
        opt.addEventListener("change", () => {
          const allChecked = Array.from(options).every(o => o.checked);
          all.checked = allChecked;
        });
      });
    });
  })();

  // === FORM ===
  (function() {
    function validateField(name, value, rules) {
      const errors = [];
      if (rules.required && !value) errors.push(`${name} é obrigatório`);
      if (rules.minlength && value.length < rules.minlength) errors.push(`${name} muito curto`);
      if (rules.email && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.push(`${name} inválido`);
      if (rules.tel && value && !/^\(?\d{2}\)?\s?\d?\s?\d{4}-?\d{4}$/.test(value)) errors.push(`${name} inválido`);
      return errors;
    }

    const RULES = {
      nome: { required: true, minlength: 2, label: "Nome" },
      celular: { required: true, tel: true, label: "Celular" },
      cidade: { required: true, minlength: 2, label: "Cidade" },
      email: { required: true, email: true, label: "E-mail" },
      pessoas: { required: true, label: "Quantidade de pessoas" }
    };

    // Fire the lead integrations for a form (fire-and-forget; errors are logged, never block UX).
    function fireLead(formType, data) {
      // One shared event id so the browser pixel and the server-side CAPI Lead
      // (fired from the CRM) collapse into a single conversion in Meta (dedup).
      const eventID = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'lead-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      data.meta_event_id = eventID;
      data.fbp = getFbp();
      if (window.RastreioLP) RastreioLP.evento('form_enviado', null, formType);
      if (formType === "orcamento") {
        submitToCRM_orcamento(data);
        if (window.fbq) fbq('track', 'Lead', { content_name: 'orcamento-superia' }, { eventID });
      } else {
        submitToCRM_espera(data);
        if (window.fbq) fbq('track', 'Lead', { content_name: 'lista-espera-superia' }, { eventID });
      }
    }

    // Thank-you screen rendered INSIDE the confirmation modal after the lead is sent.
    // Includes a close button + the WhatsApp group CTA. No hotel name in the copy.
    function buildThankYou(formType) {
      const title = formType === "orcamento" ? "Recebemos seu pedido!" : "Você está na lista!";
      const sub = formType === "orcamento"
        ? "Nossa equipe entra em contato em breve para montar a sua experiência Viva Superia."
        : "Você será o primeiro a saber quando abrirmos as próximas edições.";
      const invite = formType === "orcamento"
        ? "Enquanto isso, entre no grupo de avisos e acompanhe atrações, lotes e novidades em primeira mão:"
        : "Entre no grupo de avisos e seja o primeiro a saber quando a próxima edição abrir:";
      return `
        <button type="button" class="modal__close" aria-label="Fechar" data-modal-close>✕</button>
        <div class="form__success" role="status">
          <div class="form__success-icon" aria-hidden="true">✦</div>
          <h3 class="form__success-title">${title}</h3>
          <p class="form__success-sub">${sub}</p>
          <p class="form__success-invite">${invite}</p>
          <a class="btn btn--primary form__success-wa" href="${WA_GROUP_URL}" target="_blank" rel="noopener">✦ Entrar no grupo do WhatsApp</a>
        </div>`;
    }

    // Pending data for the confirm-tel flow (both orcamento and espera forms).
    let pendingConfirm = null;

    // The confirmation modal IS the send screen: on confirm we send and swap its own
    // content to the thank-you screen — we never go back to the form. Cache the original
    // markup so the modal resets to the phone-confirm step the next time it opens.
    const confirmModalEl = document.getElementById("modal-confirma-tel");
    const confirmContentEl = confirmModalEl && confirmModalEl.querySelector(".modal__content--confirm");
    const confirmOriginalHTML = confirmContentEl ? confirmContentEl.innerHTML : "";
    if (confirmModalEl && confirmContentEl) {
      confirmModalEl.addEventListener("modal:closed", () => {
        confirmContentEl.innerHTML = confirmOriginalHTML;
      });
    }

    document.querySelectorAll("[data-form]").forEach(form => {
      form.addEventListener("submit", async e => {
        e.preventDefault();
        const formType = form.dataset.form;
        const feedback = form.querySelector(".form__feedback");
        const data = {};
        const errors = [];

        // Standard fields (non-checkbox, non-phone-number).
        form.querySelectorAll("input, select").forEach(field => {
          if (field.type === "checkbox") {
            // Collect resorts as array; other checkboxes as boolean.
            if (field.name === "resorts") {
              if (field.dataset.resortsAll !== undefined) return; // skip "todas" master
              if (!data.resorts) data.resorts = [];
              if (field.checked) data.resorts.push(field.value);
              return;
            }
            data[field.name] = field.checked;
            return;
          }
          // Phone input handled separately below.
          if (field.dataset.phoneNumber !== undefined) return;
          if (field.dataset.phoneCountry !== undefined) {
            data[field.name] = field.value;
            return;
          }
          const rule = RULES[field.name];
          if (!rule) { data[field.name] = field.value; return; }
          const fieldErrors = validateField(rule.label, field.value.trim(), rule);
          if (fieldErrors.length) {
            field.classList.add("is-invalid");
            errors.push(fieldErrors[0]);
          } else field.classList.remove("is-invalid");
          data[field.name] = field.value.trim();
        });

        // Phone validation (works for both forms if they use phone-input, but
        // currently only espera does). The orcamento form keeps the legacy
        // RULES.celular regex via the rules path above when not using phone-input.
        const phoneInput = form.querySelector("[data-phone-number]");
        const countrySelect = form.querySelector("[data-phone-country]");
        let phoneFormatted = "";
        let phoneDial = "";
        if (phoneInput && countrySelect) {
          const opt = countrySelect.options[countrySelect.selectedIndex];
          const mask = opt?.dataset.mask || "";
          const dial = opt?.dataset.dial || "";
          const slots = (mask.match(/0/g) || []).length;
          const digits = (phoneInput.value || "").replace(/\D/g, "");
          if (!countrySelect.value) {
            countrySelect.classList.add("is-invalid");
            errors.push("Selecione o país");
          } else {
            countrySelect.classList.remove("is-invalid");
          }
          let valid = false;
          if (countrySelect.value === "OTHER") {
            valid = digits.length >= 6 && digits.length <= 15;
          } else {
            valid = digits.length === slots;
          }
          if (countrySelect.value === "BR" && valid && !celularBRValido(digits)) {
            valid = false;
            phoneInput.classList.add("is-invalid");
            errors.push("Confira o celular: DDD + número começando com 9 — ex.: (44) 99999-9999");
          } else if (!valid) {
            phoneInput.classList.add("is-invalid");
            errors.push("Celular inválido");
          } else {
            phoneInput.classList.remove("is-invalid");
          }
          phoneFormatted = applyPhoneMask(digits, mask);
          phoneDial = dial;
          data.celular = phoneInput.value.trim();
          data.celular_digits = digits;
          data.celular_dial = dial;
          data.celular_e164 = `${dial}${digits}`;
        }

        // Resorts validation (espera form).
        const resortsGroup = form.querySelector("[data-resorts-group]");
        if (resortsGroup) {
          const checkedOptions = resortsGroup.querySelectorAll("[data-resort-option]:checked");
          if (checkedOptions.length === 0) {
            resortsGroup.classList.add("is-invalid");
            errors.push("Selecione ao menos um resort");
          } else {
            resortsGroup.classList.remove("is-invalid");
          }
        }

        // Autorização obrigatória (Rafa 02/11/2026): sem o check a Prontto recusa o lead ("consentimento
        // obrigatório") e a pessoa fica sem a mensagem de confirmação no WhatsApp — o pedido não sai sem ele.
        const optIn = form.querySelector('input[name="opt_in"]');
        if (optIn && !optIn.checked) {
          optIn.closest(".form__check")?.classList.add("is-invalid");
          errors.push("Marque a autorização para enviarmos seu orçamento");
        } else optIn?.closest(".form__check")?.classList.remove("is-invalid");

        // Textarea fields (sugestoes etc).
        form.querySelectorAll("textarea").forEach(field => {
          data[field.name] = field.value.trim();
        });

        if (errors.length) {
          if (feedback) {
            feedback.classList.remove("is-success");
            feedback.classList.add("is-error");
            feedback.textContent = errors[0];
          }
          return;
        }
        // Passou: limpa o aviso de erro de uma tentativa anterior (senão ele fica na tela atrás da confirmação).
        if (feedback && feedback.classList.contains("is-error")) {
          feedback.classList.remove("is-error");
          feedback.textContent = "";
        }

        // Both forms intercept and open the phone-confirmation modal before sending.
        // Espera uses the phone-input component (dial + masked); orcamento uses the
        // legacy "celular" text field, so we show the number exactly as typed.
        const display = (phoneInput && countrySelect)
          ? `${phoneDial} ${phoneFormatted}`.trim()
          : (data.celular || "").trim();
        const displayEl = document.querySelector("[data-confirm-tel-display]");
        if (displayEl) displayEl.textContent = display;
        pendingConfirm = { form, data };
        // Open via VS_Modal (uses focus-trap + body scroll lock).
        VS_Modal.open("confirma-tel", form.querySelector(".form__submit") || document.activeElement);
        return;
      });
    });

    // Confirm-tel modal handlers.
    document.addEventListener("click", e => {
      const editBtn = e.target.closest("[data-confirm-tel-edit]");
      if (editBtn) {
        e.preventDefault();
        if (!pendingConfirm) { VS_Modal.close(); return; }
        const phoneInput = pendingConfirm.form.querySelector("[data-phone-number], input[name='celular']");
        const formModal = pendingConfirm.form.closest(".modal");
        const focusPhone = () => {
          if (!phoneInput) return;
          phoneInput.focus();
          try { phoneInput.setSelectionRange(phoneInput.value.length, phoneInput.value.length); } catch (_) {}
        };
        if (formModal) {
          // Reopen the form modal (VS_Modal.open auto-closes the confirmation modal),
          // then move focus to the phone field after open()'s own focus runs.
          VS_Modal.open(formModal.id.replace(/^modal-/, ""));
          requestAnimationFrame(() => requestAnimationFrame(focusPhone));
        } else {
          VS_Modal.close();
          requestAnimationFrame(focusPhone);
        }
        return;
      }
      const okBtn = e.target.closest("[data-confirm-tel-ok]");
      if (okBtn) {
        e.preventDefault();
        if (!pendingConfirm) { VS_Modal.close(); return; }
        const { form, data } = pendingConfirm;
        pendingConfirm = null;
        // Send right here, from the modal — never go back to the form.
        fireLead(form.dataset.form, data);
        // Swap THIS modal's content to the thank-you screen; the modal stays open.
        if (confirmContentEl) {
          confirmContentEl.innerHTML = buildThankYou(form.dataset.form);
          const focusable = confirmContentEl.querySelector("a, button");
          if (focusable) requestAnimationFrame(() => focusable.focus());
        } else {
          VS_Modal.close();
        }
      }
    });

    // Inline e-mail validation: alert as soon as the user leaves the field with an invalid address.
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    document.querySelectorAll('input[type="email"], input[name="email"]').forEach(input => {
      input.addEventListener("blur", () => {
        const value = input.value.trim();
        const form = input.closest("form");
        const feedback = form && form.querySelector(".form__feedback");
        if (value && !EMAIL_RE.test(value)) {
          input.classList.add("is-invalid");
          if (feedback) {
            feedback.classList.remove("is-success");
            feedback.classList.add("is-error");
            feedback.textContent = "E-mail inválido — confira o endereço digitado.";
          }
        } else {
          input.classList.remove("is-invalid");
          // Clear only the e-mail message we set (don't stomp other field errors).
          if (feedback && feedback.classList.contains("is-error") && feedback.textContent.startsWith("E-mail")) {
            feedback.classList.remove("is-error");
            feedback.textContent = "";
          }
        }
      });
    });

    // Show/hide "outro artista" text input when "Outro…" is selected.
    document.querySelectorAll('select[name="artista_1"], select[name="artista_2"]').forEach(sel => {
      sel.addEventListener('change', () => {
        const outroInput = sel.parentElement.querySelector('input[type="text"]');
        if (outroInput) outroInput.style.display = sel.value === 'outro' ? '' : 'none';
      });
    });
  })();

  // === CAROUSEL ===
  (function() {
    document.querySelectorAll(".carousel").forEach(root => {
      const track = root.querySelector(".carousel__track");
      const slides = track.children;
      const total = slides.length;
      if (!total) return;
      const dotsEl = root.querySelector(".carousel__dots");
      let index = 0;

      if (dotsEl) {
        dotsEl.innerHTML = Array.from({length: total}, (_, i) =>
          `<button type="button" class="carousel__dot" role="tab" aria-label="Ir para foto ${i+1}" aria-selected="${i===0}" data-index="${i}"></button>`
        ).join("");
      }

      function update() {
        track.style.transform = `translateX(-${index * 100}%)`;
        if (dotsEl) {
          dotsEl.querySelectorAll(".carousel__dot").forEach((d, i) => d.setAttribute("aria-selected", i === index));
        }
      }
      function go(delta) { index = (index + delta + total) % total; update(); }
      function goTo(i) { if (i >= 0 && i < total) { index = i; update(); } }

      // Autoplay: data-autoplay="<ms>" enables; pauses on hover, cancels on user input.
      const autoplayMs = parseInt(root.dataset.autoplay, 10);
      let autoplayTimer = null;
      let autoplayCancelled = false;
      function startAutoplay() {
        if (!autoplayMs || autoplayCancelled || autoplayTimer) return;
        autoplayTimer = setInterval(() => go(1), autoplayMs);
      }
      function stopAutoplay() {
        if (autoplayTimer) { clearInterval(autoplayTimer); autoplayTimer = null; }
      }
      function cancelAutoplay() {
        autoplayCancelled = true;
        stopAutoplay();
      }
      if (autoplayMs) {
        // Start when carousel enters viewport; stop when it leaves.
        if ("IntersectionObserver" in window) {
          const apIo = new IntersectionObserver(entries => {
            entries.forEach(en => {
              if (autoplayCancelled) return;
              if (en.isIntersecting) startAutoplay(); else stopAutoplay();
            });
          }, { threshold: 0.4 });
          apIo.observe(root);
        } else {
          startAutoplay();
        }
        root.addEventListener("mouseenter", () => { if (!autoplayCancelled) stopAutoplay(); });
        root.addEventListener("mouseleave", () => { if (!autoplayCancelled) startAutoplay(); });
      }

      root.querySelector(".carousel__btn--prev")?.addEventListener("click", () => { cancelAutoplay(); go(-1); });
      root.querySelector(".carousel__btn--next")?.addEventListener("click", () => { cancelAutoplay(); go(1); });
      dotsEl?.addEventListener("click", e => {
        const dot = e.target.closest(".carousel__dot");
        if (dot) { cancelAutoplay(); goTo(parseInt(dot.dataset.index, 10)); }
      });

      let startX = 0, deltaX = 0;
      track.addEventListener("touchstart", e => { startX = e.touches[0].clientX; deltaX = 0; }, { passive: true });
      track.addEventListener("touchmove", e => { deltaX = e.touches[0].clientX - startX; }, { passive: true });
      track.addEventListener("touchend", () => {
        if (Math.abs(deltaX) > 50) { cancelAutoplay(); go(deltaX < 0 ? 1 : -1); }
      });
    });
  })();

  // === VIDEOS WIGGLE (teaser hint there's more to scroll on mobile) ===
  (function() {
    const grid = document.querySelector("[data-videos-wiggle]");
    if (!grid || !("IntersectionObserver" in window)) return;
    let played = false;
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting || played) return;
        played = true;
        // Mobile: scrollable horizontal — do a small scroll-and-back hint.
        const isScrollable = grid.scrollWidth > grid.clientWidth + 4;
        if (isScrollable) {
          const peek = Math.min(80, grid.clientWidth * 0.2);
          setTimeout(() => grid.scrollTo({ left: peek, behavior: "smooth" }), 280);
          setTimeout(() => grid.scrollTo({ left: 0, behavior: "smooth" }), 1100);
        }
        // All viewports: subtle pulse on the cards (CSS-driven via .is-wiggling).
        grid.classList.add("is-wiggling");
        setTimeout(() => grid.classList.remove("is-wiggling"), 2200);
        io.unobserve(grid);
      });
    }, { threshold: 0.4 });
    io.observe(grid);
  })();

  // === VIDEO PLAYER ===
  (function() {
    const modal = document.getElementById("modal-video");
    const frame = modal?.querySelector("[data-video-frame]");
    if (!modal || !frame) return;

    modal.addEventListener("modal:opened", e => {
      const id = e.detail.trigger?.dataset.videoId;
      if (id) frame.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
    });
    modal.addEventListener("modal:closed", () => {
      frame.src = ""; // pause
    });
  })();

  // === LIGHTBOX ===
  (function() {
    const modal = document.getElementById("modal-lightbox");
    const img = modal?.querySelector("[data-lightbox-img]");
    const counter = modal?.querySelector("[data-lightbox-counter]");
    if (!modal || !img || !counter) return;

    let currentEdition = null, currentIndex = 0, photos = [];

    function render() {
      const p = photos[currentIndex];
      img.src = p.full; img.alt = p.alt;
      counter.textContent = `${currentIndex + 1} de ${photos.length}`;
    }
    function go(delta) {
      if (!photos.length) return;
      currentIndex = (currentIndex + delta + photos.length) % photos.length;
      render();
    }

    modal.addEventListener("modal:opened", e => {
      const t = e.detail.trigger;
      if (!t) return;
      currentEdition = t.dataset.edition;
      currentIndex = parseInt(t.dataset.index, 10) || 0;
      photos = window.VS_DATA?.gallery?.[currentEdition]?.photos || [];
      if (photos.length) render();
    });
    modal.querySelector(".modal__nav--prev").addEventListener("click", () => go(-1));
    modal.querySelector(".modal__nav--next").addEventListener("click", () => go(1));
    document.addEventListener("keydown", e => {
      if (modal.hidden) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    });
  })();

  // === META PIXEL: SCROLL TO BOTTOM ===
  (function() {
    if (!window.fbq) return;
    const footer = document.querySelector('footer');
    if (!footer || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        fbq('trackCustom', 'ScrolledToBottom', { page: 'vivasuperia' });
        io.disconnect();
      });
    }, { threshold: 0.5 });
    io.observe(footer);
  })();

  // === REVEAL ===
  (function() {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("is-revealed"); io.unobserve(en.target); } });
    }, { threshold: 0.15, rootMargin: "0px 0px -10% 0px" });

    document.querySelectorAll(".section .container > *").forEach(el => {
      el.setAttribute("data-reveal", "");
      io.observe(el);
    });
  })();

})();
