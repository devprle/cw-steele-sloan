if (!customElements.get("sticky-atc")) {
  customElements.define(
    "sticky-atc",
    class StickyAtc extends HTMLElement {
      constructor() {
        super();
        this.selectors = {
          prodTitle: ".m-sticky-addtocart--title",
          mainImage: ".m-sticky-addtocart--image",
          addToCart: ".m-add-to-cart",
          buyNowBtn: ".m-product-dynamic-checkout",
          variantIdSelect: '[name="id"]',
          foxkitBtn: ".foxkit-button",
          select: "select",
        };
        this.hasCustomFields = !!document.querySelector(".m-main-product--info .m-product-custom-field");
      }

      connectedCallback() {
        this.mainProduct = document.querySelector("product-info[id^='MainProduct']");
        this.container = this.closest(".m-sticky-addtocart");
        this.mainProductForm = document.querySelector(".m-product-form--main");
        this.mainProductInfo = document.querySelector(".m-main-product--info");
        this.mainAddToCart = this.mainProductForm.querySelector(".m-add-to-cart");
        this.mainDynamicCheckout = this.mainProductForm.querySelector(this.selectors.buyNowBtn);
        this.disableSelectedVariantDefault = this.mainProduct.dataset.disableSelectedVariantDefault === "true" || false;
        this.domNodes = queryDomNodes(this.selectors, this.container);

        this.init();
      }

      init() {
        if (!this.mainAddToCart) {
          this.container.style.setProperty("--m-translate-y", 0);
          return;
        }

        this.variantData = this.getVariantData();

        const headerHeight = MinimogSettings.headerHeight || 66;
        const rootMargin = `${headerHeight}px 0px 0px 0px`;

        if ("IntersectionObserver" in window) {
          this.observer = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (entry.intersectionRatio !== 1) {
                  this.container.style.setProperty("--m-translate-y", 0);
                } else {
                  this.container.style.setProperty("--m-translate-y", "100%");
                }
                document.documentElement.classList[entry.intersectionRatio !== 1 ? "add" : "remove"]("stick-atc-show");
              });
            },
            { threshold: 1, rootMargin }
          );
        }

        if (this.disableSelectedVariantDefault) {
          this.handleDisableSelectedVariantDefault();
        }

        const { prodTitle, mainImage } = this.domNodes;
        prodTitle.addEventListener("click", () => __scrollToTop());
        mainImage.addEventListener("click", () => __scrollToTop());

        this.handleCustomFields();

        this.setObserveTarget();
        this.syncWithMainProductForm();

        const mql = window.matchMedia(MinimogTheme.config.mediaQueryMobile);
        mql.onchange = this.setStickyAddToCartHeight.bind(this);
        this.setStickyAddToCartHeight();

        this.optionSelects = Array.from(this.querySelectorAll("[data-sticky-option]"));
        if (this.optionSelects.length) {
          this.optionSelects.forEach((select) => select.addEventListener("change", this.onOptionChange.bind(this)));
          this.updateSwatch();
        } else if (this.domNodes.select) {
          this.domNodes.select.addEventListener("change", (e) => {
            const { target } = e;
            const variantPicker = this.mainProduct.querySelector('variant-picker');
            const selectedVariantId = this.querySelector(this.selectors.variantIdSelect).value;
            this.currentVariant = this.variantData.find((variant) => variant.id === Number(selectedVariantId));
            this.currentVariant ? this.toggleAddButton(!this.currentVariant.available, window.MinimogStrings.soldOut) : this.toggleAddButton(true, window.MinimogStrings.unavailable);

            const selectedOption = target.options[target.selectedIndex];
            const selectedOptionIds = (selectedOption.dataset.options || '').split(',').filter(id => id);
            if (variantPicker) {
              selectedOptionIds.forEach((optionId) => this.selectMainOption(variantPicker, optionId));
              variantPicker.dispatchEvent(new Event("change"));
            }
          });
        }
      }

      // One select per product option (Color / Size ...): resolve the variant and mirror it in the main picker
      onOptionChange() {
        const values = this.optionSelects.map((select) => select.value);
        const variant = this.variantData.find((v) => v.options.every((value, i) => value === values[i]));
        const variantInput = this.querySelector('[name="id"]');

        this.currentVariant = variant;
        variantInput.value = variant ? variant.id : '';
        variant
          ? this.toggleAddButton(!variant.available, window.MinimogStrings.soldOut)
          : this.toggleAddButton(true, window.MinimogStrings.unavailable);
        this.updatePrice(variant);
        this.updateSwatch();

        const variantPicker = this.mainProduct.querySelector('variant-picker');
        if (variantPicker) {
          this.optionSelects.forEach((select) => {
            const optionId = select.options[select.selectedIndex].dataset.optionValueId;
            this.selectMainOption(variantPicker, optionId);
          });
          variantPicker.dispatchEvent(new Event("change"));
        }
      }

      selectMainOption(variantPicker, optionId) {
        const input = variantPicker.querySelector(`[data-option-value-id="${optionId}"]`);
        if (!input) return;
        if (input.tagName === "OPTION") {
          input.parentNode.value = input.value;
        } else if (input.tagName === "INPUT") {
          input.checked = true;
        }
      }

      updateSwatch() {
        const swatch = this.querySelector("[data-sticky-swatch]");
        if (!swatch) return;
        const select = swatch.closest("label").querySelector("select");
        const option = select.options[select.selectedIndex];
        swatch.style.background = (option && option.dataset.swatch) || "";
      }

      updatePrice(variant) {
        const priceEl = this.querySelector("[data-sticky-price]");
        if (!priceEl || !variant || typeof formatMoney !== "function") return;
        priceEl.textContent = formatMoney(variant.price, MinimogSettings.money_format);
      }

      getVariantData() {
        this.variantData = this.variantData || JSON.parse(this.container.querySelector('[type="application/json"]').textContent);
        return this.variantData;
      }

      setObserveTarget() {
        if (this.observer) {
          this.observer.observe(this.mainProductForm);
          this.observeTarget = this.mainProductForm;
        }
      }

      setUnavailable() {
        const productForm = this.querySelector('.m-product-form');
        const addButton = productForm.querySelector('[name="add"]');

        if (addButton) {
          this.toggleAddButton(true, window.MinimogStrings.unavailable);
        }
      }

      toggleAddButton(disable = true, text, modifyClass = true) {
        const productForm = this.querySelector('.m-product-form');
        if (!productForm) return;
        const addButton = productForm.querySelector('[name="add"]');
        const addButtonText = productForm.querySelector('[name="add"] > span.m-add-to-cart--text');
        if (!addButton) return;

        if (disable) {
          addButton.setAttribute('disabled', 'disabled');
          if (text) addButtonText.textContent = text;
        } else {
          addButton.removeAttribute('disabled');
          addButtonText.innerHTML = window.MinimogStrings.addToCart;
        }

        if (!modifyClass) return;
      }

      handleDisableSelectedVariantDefault() {
        let urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has("variant")) return;

        const pickerFields = this.querySelector('.m-product-option--dropdown-select');

        if (pickerFields) pickerFields.value = '';
        this.setUnavailable();
      }

      setStickyAddToCartHeight() {
        document.documentElement.style.setProperty("--f-sticky-atc-bar-height", this.offsetHeight + "px");
        window.MinimogSettings.stickyAddToCartHeight = this.offsetHeight;
      }

      syncWithMainProductForm() {
        const variantInput = this.querySelector('[name="id"]');
        MinimogEvents.subscribe(MinimogTheme.pubSubEvents.variantChange, (e) => {
          const isMainProduct = e.data.sectionId === this.mainProduct.dataset.sectionId;
          if (!isMainProduct) return;
          this.currentVariant = e.data.variant;
          if (this.currentVariant) {
            variantInput.value = e.data.variant.id;
            this.toggleAddButton(!this.currentVariant.available, window.MinimogStrings.soldOut)
            if (this.optionSelects) {
              this.optionSelects.forEach((select, i) => {
                if (this.currentVariant.options[i] !== undefined) select.value = this.currentVariant.options[i];
              });
              this.updateSwatch();
            }
            this.updatePrice(this.currentVariant);
          } else {
            variantInput.value = '';
            this.toggleAddButton(true, window.MinimogStrings.unavailable)
          }
        });
      }

      handleCustomFields() {
        if (!this.hasCustomFields) return;

        const { addToCart, buyNowBtn, foxkitBtn } = this.domNodes;

        let hasCustomFieldRequired = false;
        const customFields = document.querySelectorAll(".m-main-product--info .m-product-custom-field");
        let customFieldFirst = customFields[0];
        customFields &&
          customFields.forEach((item) => {
            const field = item.querySelector(".form-field");
            if (field.value == "" && field.hasAttribute("required")) {
              hasCustomFieldRequired = true;
            }
          });

        hasCustomFieldRequired &&
          addToCart.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            __scrollToTop(this.mainProductInfo, () => this.mainAddToCart.click());
          });
        if (buyNowBtn) {
          buyNowBtn.addEventListener(
            "click",
            (e) => {
              const missing = validateForm(this.mainProductInfo);
              if (missing.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                __scrollToTop(this.mainProductInfo, () => this.mainDynamicCheckout.click());
              }
            },
            true
          );
        }
        if (foxkitBtn) {
          foxkitBtn.addEventListener("click", (e) => {
            e.preventDefault();
            __scrollToTop(this.mainProductInfo, () => this.mainAddToCart.click());
          });
        }
      }
    }
  );
}
