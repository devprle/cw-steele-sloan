class MCartDrawer extends HTMLElement {
  constructor() {
    super();
    this.getSectionToRenderListener = this.getSectionToRender.bind(this);
    this.onCartRefreshListener = this.onCartRefresh.bind(this);

    this.rootUrl = window.Shopify.routes.root;
  }

  get sectionName() {
    return 'cart-drawer';
  }

  get cartDrawerInner() {
    return this.querySelector(".m-cart-drawer__inner");
  }

  get cartDrawerCloseIcon() {
    return this.querySelector(".m-cart-drawer__close");
  }

  getSectionToRender(event) {
    event.detail.sections.push(this.sectionName);
  }

  connectedCallback() {
    this.setHeaderCartIconAccessibility();
    this.addEventListener("click", (event) => {
      if (event.target.closest(".m-cart-drawer__inner") !== this.cartDrawerInner || event.target === this.cartDrawerCloseIcon) {
        this.close();
      }
    });

    document.addEventListener('cart:grouped-sections', this.getSectionToRenderListener);
    document.addEventListener("cart:refresh", this.onCartRefreshListener);
  }

  disconnectedCallback() {
    document.removeEventListener('cart:grouped-sections', this.getSectionToRenderListener);
    document.removeEventListener("cart:refresh", this.onCartRefreshListener);
  }

  setHeaderCartIconAccessibility() {
    const cartLinks = document.querySelectorAll(".m-cart-icon-bubble");
    cartLinks.forEach((cartLink) => {
      cartLink.setAttribute("role", "button");
      cartLink.setAttribute("aria-haspopup", "dialog");
      cartLink.addEventListener("click", (event) => {
        if (MinimogSettings.enable_cart_drawer) {
          event.preventDefault();
          this.open(cartLink);
        }
      });
    });
  }

  async onCartRefresh(event) {
    const cartDrawer = document.getElementById("MinimogCartDrawer");
    if (!cartDrawer) return;

    try {
      const response = await fetch(
        `${this.rootUrl}?section_id=cart-drawer`
      );
      const responseText = await response.text();

      const parser = new DOMParser();
      const parsedHTML = parser.parseFromString(responseText, "text/html");

      const newCartContent = parsedHTML.getElementById("MinimogCartDrawer").innerHTML;
      cartDrawer.innerHTML = newCartContent;

      if (event.detail.open === true) {
        if (!this.classList.contains("m-cart-drawer--active")) {
          this.open();
        } else {
          this.cartDrawerInner.style.setProperty("--translate-x", "0");
        }
      }
    } catch (error) {
      console.error("Error refreshing cart:", error);
    }
  }

  open(triggeredBy) {
    if (triggeredBy) this.setActiveElement(triggeredBy);
    this.classList.add("m-cart-drawer--active");
    document.documentElement.classList.add("prevent-scroll");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.style.setProperty("--m-bg-opacity", "0.5");
        this.cartDrawerInner.style.setProperty("--translate-x", "0");
        window.MinimogEvents.emit(MinimogTheme.pubSubEvents.openCartDrawer);
      });
    });
  }

  close() {
    this.style.setProperty("--m-bg-opacity", "0");
    this.cartDrawerInner.style.setProperty("--translate-x", "100%");
    setTimeout(() => {
      this.classList.remove("m-cart-drawer--active");
      document.documentElement.classList.remove("prevent-scroll");
    }, 300);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define("m-cart-drawer", MCartDrawer);

class MCartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener("click", (event) => {
      event.preventDefault();
      const cartItems = this.closest("m-cart-items");
      cartItems.updateQuantity(this.dataset.index, 0);
    });
  }
}

customElements.define("m-cart-remove-button", MCartRemoveButton);

class MCartTemplate extends HTMLElement {
  constructor() {
    super();
    document.addEventListener('cart:grouped-sections', this.getSectionToRender.bind(this));
  }

  get sectionName() {
    return 'cart-template';
  }

  getSectionToRender(event) {
    event.detail.sections.push(this.sectionName);
  }
}

customElements.define("m-cart", MCartTemplate);

class MCartItems extends HTMLElement {
  preProcessHtmlCallbacks = [];
  postProcessHtmlCallbacks = [];

  constructor() {
    super();

    this.addEventListener('change', debounce(this.onChange.bind(this), 300));
    this.cartUpdateUnsubscriber = MinimogEvents.subscribe(MinimogTheme.pubSubEvents.cartUpdate, this.onCartUpdate.bind(this));

    window.FoxKitSections = [this.sectionName, this.cartCountSectionName];
  }

  connectedCallback() {
    this.isCartPage = MinimogSettings.templateName === "cart";
    this.cartDrawerInner = document.querySelector(".m-cart-drawer__inner");
    let loadingTarget = this.cartDrawerInner;
    if (this.isCartPage) loadingTarget = document.body;
    this.loading = new MinimogLibs.AnimateLoading(loadingTarget, { overlay: loadingTarget });
  }

  get sectionName() {
    return this.dataset.sectionName || 'cart-template';
  }

  get cartCountSectionName() {
    return 'cart-count';
  }

  cartUpdateUnsubscriber = undefined;
  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  onChange(event) {
    const { target } = event;
    if (target.closest('m-quantity-input')) {
      this.updateQuantity(
        target.dataset.index,
        target.value,
        document.activeElement.getAttribute('name'),
        target
      );
    }
  }

  onCartError(errors, target, line) {
    if (target) {
      this.setValidity(target, errors);
    } else {
      window.location.href = MinimogSettings.routes.cart;
    }

    this.updateLiveRegions(line, errors);
  }

  onCartUpdate(event) {
    const sectionToRender = new DOMParser().parseFromString(event.cart.sections[this.sectionName], 'text/html');

    const cartDrawer = document.querySelector(`#MinimogCartDrawer`);
    if (cartDrawer) {
      const cartDrawerBody = cartDrawer.querySelector(`#cart-drawer-form`);
      const cartDrawerFooter = cartDrawer.querySelector(`#MinimogCartDrawerFooter`);
      if (cartDrawerBody) {
        HTMLUpdateUtility.viewTransition(
          cartDrawerBody,
          sectionToRender.querySelector('#cart-drawer-form'),
          this.preProcessHtmlCallbacks,
          this.postProcessHtmlCallbacks
        );
      }
      if (cartDrawerFooter) {
        HTMLUpdateUtility.viewTransition(
          cartDrawerFooter,
          sectionToRender.querySelector('#MinimogCartDrawerFooter'),
          this.preProcessHtmlCallbacks,
          this.postProcessHtmlCallbacks
        );
      }
    }

    const mainCart = document.querySelector(`#MinimogCart`);
    if (mainCart) {
      const cartHeader = mainCart.querySelector(`#MinimogCartHeader`);
      const cartBody = mainCart.querySelector(`#MinimogCartBody`);
      const cartFooter = mainCart.querySelector(`#MinimogCartFooter`);
      if (cartHeader) {
        HTMLUpdateUtility.viewTransition(
          cartHeader,
          sectionToRender.querySelector('#MinimogCartHeader'),
          this.preProcessHtmlCallbacks,
          this.postProcessHtmlCallbacks
        );
      }
      if (cartBody) {
        HTMLUpdateUtility.viewTransition(
          cartBody,
          sectionToRender.querySelector('#MinimogCartBody'),
          this.preProcessHtmlCallbacks,
          this.postProcessHtmlCallbacks
        );
      }
      if (cartFooter) {
        HTMLUpdateUtility.viewTransition(
          cartFooter,
          sectionToRender.querySelector('#MinimogCartFooter'),
          this.preProcessHtmlCallbacks,
          this.postProcessHtmlCallbacks
        );
      }
    }

    document.dispatchEvent(
      new CustomEvent('cart:updated', {
        detail: {
          cart: event.cart,
        },
      })
    );
  }

  updateQuantity(line, quantity, name, target) {
    this.loading.start();

    const { routes } = window.MinimogSettings;

    let sectionsToBundle = [];
    document.documentElement.dispatchEvent(
      new CustomEvent('cart:grouped-sections', { bubbles: true, detail: { sections: sectionsToBundle } })
    );

    const body = JSON.stringify({
      line,
      quantity,
      sections: sectionsToBundle,
    });

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => response.json())
      .then((response) => {

        let quantityElement = document.getElementById(`MinimogDrawer-quantity-${line}`);

        if (this.isCartPage) {
          quantityElement = document.getElementById(`MinimogQuantity-${line}`);
        }

        if (response.errors) {
          this.loading.finish();
          quantityElement.value = quantityElement.getAttribute("value");
          this.onCartError(response.errors, target, line);
          return;
        }

        const items = document.querySelectorAll(".m-cart-item");

        const updatedValue = response.items[line - 1] ? response.items[line - 1].quantity : undefined;
        let message = "";
        if (items.length === response.items.length && updatedValue !== parseInt(quantityElement.value)) {
          if (typeof updatedValue === "undefined") {
            message = window.MinimogStrings.cartError;
          } else {
            message = window.MinimogStrings.quantityError.replace("{{ quantity }}", updatedValue);
          }
        }
        this.updateLiveRegions(line, message);

        window.MinimogEvents.emit(MinimogTheme.pubSubEvents.cartUpdate, { cart: response });
      })
      .catch((error) => {
        console.log(error);
      }).finally(() => {
        this.loading.finish();
      });
  }

  updateLiveRegions(line, message) {
    let lineItemNode = document.getElementById(`MinimogCart-Item-${line}`);
    if (message !== "" && lineItemNode) {
      MinimogTheme.Notification.show({
        target: lineItemNode,
        type: "warning",
        message: message,
      });
    }
  }

  setValidity(target, message) {
    target.setCustomValidity(message);
    target.reportValidity();
    target.value = target.defaultValue;
    target.select();
  }
}

customElements.define("m-cart-items", MCartItems);

window.FoxKitAddToCart = async (payload) => {
  if (!payload?.properties?.['_FoxKit offer']) return;

  window.MinimogEvents.emit(MinimogTheme.pubSubEvents.cartUpdate, { cart: payload });

  document.dispatchEvent(
    new CustomEvent('product-ajax:added', {
      detail: {
        product: payload,
      },
    })
  );
};