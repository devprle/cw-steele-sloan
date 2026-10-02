/* Cart drawer redesign: "You Will Also Love" recommendations + delivery estimate */

if (!customElements.get('steele-cart-recommendations')) {
  class SteeleCartRecommendations extends HTMLElement {
    connectedCallback() {
      this.onCartUpdated = () => this.load();
      document.addEventListener('cart:updated', this.onCartUpdated);
      if (this.dataset.productId) this.load(this.dataset.productId);
    }

    disconnectedCallback() {
      document.removeEventListener('cart:updated', this.onCartUpdated);
      this.resizeObserver?.disconnect();
    }

    async load(productId) {
      const requestId = (this.requestId = (this.requestId || 0) + 1);
      try {
        if (!productId) {
          const cart = await fetch(`${window.Shopify?.routes?.root || '/'}cart.js`).then((r) => r.json());
          productId = cart.items?.[0]?.product_id;
        }
        if (!productId) {
          this.innerHTML = '';
          return;
        }
        const url = `${this.dataset.url}?product_id=${productId}&limit=10&section_id=cart-drawer-recommendations`;
        const html = await fetch(url).then((r) => r.text());
        if (requestId !== this.requestId) return; // a newer request superseded this one
        const recs = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-steele-cart-recs]');
        this.innerHTML = recs ? recs.innerHTML : '';
        this.initSlider();
      } catch (error) {
        console.error('Cart recommendations failed to load', error);
      }
    }

    initSlider() {
      const track = this.querySelector('[data-recs-track]');
      const prev = this.querySelector('[data-recs-prev]');
      const next = this.querySelector('[data-recs-next]');
      if (!track || !prev || !next) return;

      const update = () => {
        const maxScroll = track.scrollWidth - track.clientWidth - 1;
        prev.disabled = track.scrollLeft <= 0;
        next.disabled = track.scrollLeft >= maxScroll;
      };
      prev.addEventListener('click', () => track.scrollBy({ left: -track.clientWidth, behavior: 'smooth' }));
      next.addEventListener('click', () => track.scrollBy({ left: track.clientWidth, behavior: 'smooth' }));
      track.addEventListener('scroll', update, { passive: true });
      // Recs usually load while the drawer is closed (zero width), so re-check once it's laid out
      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(update);
      this.resizeObserver.observe(track);
      update();
    }
  }
  customElements.define('steele-cart-recommendations', SteeleCartRecommendations);
}

if (!customElements.get('steele-delivery-estimate')) {
  // Shopify doesn't expose delivery estimates before checkout, so this is calculated from
  // the theme settings: same-day cutoff (US Eastern) + transit time in business days.
  class SteeleDeliveryEstimate extends HTMLElement {
    connectedCallback() {
      const cutoffHour = parseInt(this.dataset.cutoffHour, 10);
      const minDays = parseInt(this.dataset.minDays, 10) || 1;
      const maxDays = Math.max(parseInt(this.dataset.maxDays, 10) || minDays, minDays);
      const shipFrom = this.dataset.shipFrom;

      const now = this.easternNow();
      const today = new Date(Date.UTC(now.year, now.month - 1, now.day));

      let shipDate = new Date(today);
      if (this.isWeekend(shipDate) || now.hour >= cutoffHour) {
        shipDate = this.addBusinessDays(shipDate, 1);
      }

      const earliest = this.addBusinessDays(shipDate, minDays);
      const latest = this.addBusinessDays(shipDate, maxDays);
      const range = minDays === maxDays ? this.format(earliest) : `${this.format(earliest)} – ${this.format(latest)}`;

      const daysUntilShip = Math.round((shipDate - today) / 86400000);
      let shipLabel = `Ships ${shipDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}`;
      if (daysUntilShip === 0) shipLabel = 'Ships today';
      if (daysUntilShip === 1) shipLabel = 'Ships tomorrow';

      const rangeEl = this.querySelector('[data-delivery-range]');
      const shipEl = this.querySelector('[data-delivery-ship]');
      if (rangeEl) rangeEl.textContent = range;
      if (shipEl) shipEl.textContent = shipFrom ? `${shipLabel} from ${shipFrom}` : shipLabel;
      this.classList.add('is-ready');
    }

    easternNow() {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        hourCycle: 'h23',
      }).formatToParts(new Date());
      const get = (type) => parseInt(parts.find((p) => p.type === type).value, 10);
      return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
    }

    isWeekend(date) {
      const day = date.getUTCDay();
      return day === 0 || day === 6;
    }

    addBusinessDays(date, days) {
      const result = new Date(date);
      let added = 0;
      while (added < days) {
        result.setUTCDate(result.getUTCDate() + 1);
        if (!this.isWeekend(result)) added++;
      }
      return result;
    }

    format(date) {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
    }
  }
  customElements.define('steele-delivery-estimate', SteeleDeliveryEstimate);
}
