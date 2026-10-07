(function () {
  const script = document.currentScript;
  if (!script) return;

  const scriptUrl = new URL(script.src);
  const widgetId = scriptUrl.searchParams.get('id');
  const target = document.querySelector('[data-widget-container]') || document.body;
  const container = document.createElement('section');
  container.setAttribute('aria-live', 'polite');
  const status = document.createElement('p');
  status.className = 'flyrank-widget-status';
  status.setAttribute('data-widget-status', '');
  container.appendChild(status);
  target.appendChild(container);

  function showMessage(message, isError) {
    const status = container.querySelector('[data-widget-status]');
    if (!status) return;
    status.textContent = message;
    status.setAttribute('role', isError ? 'alert' : 'status');
  }

  function appendField(form, field) {
    const label = document.createElement('label');
    label.textContent = field.label;

    const input = field.type === 'textarea'
      ? document.createElement('textarea')
      : document.createElement('input');
    input.name = field.name;
    input.required = field.required;
    input.maxLength = field.maxLength;
    if (field.type === 'email') input.type = 'email';
    label.appendChild(input);
    form.appendChild(label);
  }

  async function initialize() {
    if (!widgetId) {
      showMessage('This widget is not configured.', true);
      return;
    }

    try {
      const configResponse = await fetch(
        `${scriptUrl.origin}/api/widgets/${encodeURIComponent(widgetId)}/config`
      );
      if (!configResponse.ok) throw new Error('Widget configuration unavailable');
      const config = await configResponse.json();

      const style = document.createElement('style');
      style.textContent = `
        .flyrank-widget { border: 1px solid #d1d5db; border-radius: 8px; color: #111827;
          font: 16px system-ui, sans-serif; max-width: 28rem; padding: 1rem; }
        .flyrank-widget label { display: block; margin: .75rem 0; }
        .flyrank-widget input, .flyrank-widget textarea, .flyrank-widget button {
          box-sizing: border-box; display: block; font: inherit; margin-top: .25rem;
          padding: .5rem; width: 100%; }
        .flyrank-widget [data-honeypot] { height: 1px; left: -10000px; overflow: hidden;
          position: absolute; top: auto; width: 1px; }
        .flyrank-widget-status { min-height: 1.5em; }
      `;
      container.appendChild(style);

      const card = document.createElement('div');
      card.className = 'flyrank-widget';
      if (config.displayOptions && config.displayOptions.theme === 'dark') {
        card.style.backgroundColor = '#1f2937';
        card.style.color = '#f9fafb';
      }
      const title = document.createElement('h2');
      title.textContent = config.title;
      card.appendChild(title);
      if (config.description) {
        const description = document.createElement('p');
        description.textContent = config.description;
        card.appendChild(description);
      }

      const form = document.createElement('form');
      for (const field of config.fields) appendField(form, field);
      const honeypot = document.createElement('div');
      honeypot.setAttribute('data-honeypot', '');
      honeypot.setAttribute('aria-hidden', 'true');
      const trap = document.createElement('input');
      trap.name = 'website_url';
      trap.tabIndex = -1;
      trap.autocomplete = 'off';
      honeypot.appendChild(trap);
      form.appendChild(honeypot);

      const button = document.createElement('button');
      button.type = 'submit';
      button.textContent = config.buttonText;
      form.appendChild(button);

      form.appendChild(status);
      card.appendChild(form);
      container.appendChild(card);

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = {};
        for (const field of config.fields) {
          formData[field.name] = form.elements.namedItem(field.name).value;
        }
        button.disabled = true;
        showMessage('Sending…', false);
        try {
          const result = await fetch(`${scriptUrl.origin}/api/submissions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              widget_id: config.id,
              form_data: formData,
              website_url: trap.value
            })
          });
          const body = await result.json();
          if (!result.ok) throw new Error(body.message || 'Submission was not accepted');
          form.reset();
          showMessage('Thank you. Your submission was received.', false);
        } catch (error) {
          showMessage(error.message || 'Unable to submit this form.', true);
        } finally {
          button.disabled = false;
        }
      });
    } catch {
      showMessage('This widget is temporarily unavailable.', true);
    }
  }

  initialize();
}());
