(function () {
  // single reusable cat element
  const cat = document.createElement('img');
  cat.src = 'https://github.com/simpleuserdontwatch/storage/blob/main/no-no-no.gif?raw=true';
  cat.width = 32;
  cat.height = 32;
  cat.style.transition = 'opacity 0.18s, transform 0.18s';
  cat.style.opacity = 0;
  cat.style.display = 'block';
  cat.style.position = 'fixed';
  cat.style.pointerEvents = 'none';
  cat.style.zIndex = 2147483647;
  document.body.appendChild(cat);

  // helper: get caret viewport position for textarea or contenteditable
  function getcaretpos(el) {
    if (el.nodeName === 'TEXTAREA' || el.nodeName === 'INPUT' && el.type === 'text') {
      return getCaretForTextarea(el);
    } else if (el.isContentEditable) {
      return getCaretForContentEditable(el);
    }
    return null;
  }

  // textarea caret measurement via mirror overlay
  function getCaretForTextarea(textarea) {
    const sel = textarea.selectionStart ?? 0;
    const style = getComputedStyle(textarea);
    const taRect = textarea.getBoundingClientRect();

    const mirror = document.createElement('div');
    document.body.appendChild(mirror);

    // copy necessary styles
    const props = [
      'boxSizing', 'width', 'height',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'lineHeight', 'fontFamily',
      'textAlign', 'direction', 'letterSpacing', 'textTransform', 'whiteSpace', 'overflowWrap', 'wordWrap'
    ];

    mirror.style.position = 'absolute';
    mirror.style.left = `${taRect.left}px`;
    mirror.style.top = `${taRect.top}px`;
    mirror.style.overflow = 'auto';
    mirror.style.visibility = 'hidden';
    mirror.style.pointerEvents = 'none';

    for (const p of props) {
      mirror.style[p] = style[p] || style.getPropertyValue(p.replace(/([A-Z])/g, '-$1').toLowerCase());
    }

    // ensure exact pixel size to match wrapping
    mirror.style.width = `${taRect.width}px`;
    mirror.style.height = `${taRect.height}px`;
    mirror.style.boxSizing = style.boxSizing;

    // build content up to caret, with marker span
    const before = textarea.value.substring(0, sel);
    const textNode = document.createTextNode(before);
    const span = document.createElement('span');
    span.textContent = '\u200b';

    mirror.appendChild(textNode);
    mirror.appendChild(span);

    // sync scroll so visible portion matches
    mirror.scrollTop = textarea.scrollTop;
    mirror.scrollLeft = textarea.scrollLeft;

    const rect = span.getBoundingClientRect();

    // compute lineHeight fallback
    let computedLineHeight = parseFloat(style.lineHeight);
    if (isNaN(computedLineHeight)) {
      computedLineHeight = parseFloat(style.fontSize) || rect.height || 16;
    }

    const result = {
      x: rect.left,
      y: rect.top,
      height: rect.height || computedLineHeight,
      lineHeight: computedLineHeight
    };

    document.body.removeChild(mirror);
    return result;
  }

  // contenteditable caret measurement using Range; insert a temporary marker if needed
  function getCaretForContentEditable(el) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    // prefer the range inside this element
    let range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer)) {
      // try to find a range inside el by walking selection anchors
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      range = r;
    }

    // if range has a clientRect, use it
    const rects = range.getClientRects();
    if (rects && rects.length > 0) {
      const r = rects[0];
      const style = getComputedStyle(el);
      let computedLineHeight = parseFloat(style.lineHeight);
      if (isNaN(computedLineHeight)) computedLineHeight = parseFloat(style.fontSize) || r.height || 16;
      return { x: r.left, y: r.top, height: r.height || computedLineHeight, lineHeight: computedLineHeight };
    }

    // fallback: insert temporary marker span at caret, measure, then restore selection
    const marker = document.createElement('span');
    marker.textContent = '\u200b';
    marker.style.all = 'unset';
    marker.style.display = 'inline-block';
    marker.style.width = '1px';
    marker.style.height = '1px';
    marker.style.lineHeight = 'normal';

    const origRange = range.cloneRange();
    range.insertNode(marker);

    const rect = marker.getBoundingClientRect();
    const style = getComputedStyle(el);
    let computedLineHeight = parseFloat(style.lineHeight);
    if (isNaN(computedLineHeight)) computedLineHeight = parseFloat(style.fontSize) || rect.height || 16;

    // remove marker and restore selection
    const parent = marker.parentNode;
    if (parent) parent.removeChild(marker);

    // restore original selection
    sel.removeAllRanges();
    sel.addRange(origRange);

    return { x: rect.left, y: rect.top, height: rect.height || computedLineHeight, lineHeight: computedLineHeight };
  }

  // get plain text before caret for contenteditable
  function getTextBeforeCaretInContentEditable(el) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return '';
    const range = sel.getRangeAt(0).cloneRange();
    if (!el.contains(range.startContainer)) return '';
    const start = document.createRange();
    start.selectNodeContents(el);
    start.setEnd(range.startContainer, range.startOffset);
    return start.toString();
  }

  // delete char before caret in contenteditable
  function deleteCharBeforeCaretContentEditable(el) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) {
      range.deleteContents();
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }

    // try simple case: startContainer is text node with offset > 0
    let startContainer = range.startContainer;
    let startOffset = range.startOffset;

    if (startContainer.nodeType === 3 && startOffset > 0) {
      const newRange = document.createRange();
      newRange.setStart(startContainer, startOffset - 1);
      newRange.setEnd(startContainer, startOffset);
      newRange.deleteContents();
      sel.removeAllRanges();
      const collapseRange = document.createRange();
      collapseRange.setStart(startContainer, startOffset - 1);
      collapseRange.collapse(true);
      sel.addRange(collapseRange);
      return;
    }

    // otherwise, find previous text node
    let node = startContainer;
    function prevTextNode(n, boundary) {
      let cur = n;
      while (cur && cur !== boundary) {
        if (cur.previousSibling) {
          cur = cur.previousSibling;
          while (cur.lastChild) cur = cur.lastChild;
          if (cur.nodeType === 3) return cur;
        } else {
          cur = cur.parentNode;
        }
      }
      return null;
    }
    const prev = prevTextNode(startContainer, el);
    if (prev) {
      const prevLen = prev.nodeValue.length;
      const newRange = document.createRange();
      newRange.setStart(prev, prevLen - 1);
      newRange.setEnd(prev, prevLen);
      newRange.deleteContents();

      // place caret
      const collapseRange = document.createRange();
      collapseRange.setStart(prev, prevLen - 1);
      collapseRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(collapseRange);
    }
  }

  // delete char before caret in textarea
  function deleteCharBeforeCaretTextarea(el) {
    const pos = el.selectionStart;
    if (typeof pos !== 'number') return;
    if (pos > 0) {
      const before = el.value.slice(0, pos - 1);
      const after = el.value.slice(pos);
      el.value = before + after;
      el.setSelectionRange(pos - 1, pos - 1);
      // dispatch input event so page notices value change
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // attach handler to an editable element (textarea or contenteditable)
  function attachEditable(el) {
    if (el.__friendlyCatAttached) return;
    el.__friendlyCatAttached = true;

    el.addEventListener('input', (ev) => {
      try {
        if (el.nodeName === 'TEXTAREA' || (el.nodeName === 'INPUT' && el.type === 'text')) {
          const before = el.value.substring(0, el.selectionStart ?? 0).toLowerCase();
          handleChecksAndCat(el, before);
        } else if (el.isContentEditable) {
          const before = getTextBeforeCaretInContentEditable(el).toLowerCase();
          handleChecksAndCat(el, before);
        }
      } catch (e) {
        // fail silently
      }
      if (el.nodeName === 'TEXTAREA' || (el.nodeName === 'INPUT' && el.type === 'text')) {
        el.value = el.value.replace(/(nigger|clanker|nigga)/gi, '');
      }
    });

    // also listen to keydown to prevent the forbidden final character (smoother)
    el.addEventListener('keydown', (ev) => {
      try {
        const key = ev.key.toLowerCase();
        // if they try to type 'g' or the hard r as final char, we can prevent default early
        if (key === 'g' || key === 'r') {
          let beforeText = '';
          if (el.nodeName === 'TEXTAREA' || (el.nodeName === 'INPUT' && el.type === 'text')) {
            beforeText = el.value.substring(0, el.selectionStart ?? 0).toLowerCase();
          } else if (el.isContentEditable) {
            beforeText = getTextBeforeCaretInContentEditable(el).toLowerCase();
          }
          // detect sequences that would complete the slur
          if ((beforeText.endsWith('nigg') && key === 'r') || (beforeText.endsWith('nig') && key === 'g') ||
              (beforeText.endsWith('clank') && key === 'r') || (beforeText.endsWith('clan') && key === 'k')) {
            ev.preventDefault();
            // show cat and (for input fallback) delete last char if needed
            showCatAtCaret(el);
            // try to delete previous char to ensure it can't be completed
            
          }
        }
      } catch (e) {}
    });
  }

  // logic to check the 'before' text and act
  function handleChecksAndCat(el, before) {
    if (before.endsWith('nig') || before.endsWith('clan')) {
      showCatAtCaret(el);
    } else if (before.endsWith('nigg') || before.endsWith('clank')) {
      // remove char before caret (works for mid-text too)
      if (el.isContentEditable) deleteCharBeforeCaretContentEditable(el);
      else deleteCharBeforeCaretTextarea(el);
      showCatAtCaret(el);
    } else {
      hideCat();
    }
  }

  // show cat at current caret position (fixed viewport coords)
  function showCatAtCaret(el) {
    const pos = getcaretpos(el);
    if (!pos) return;
    const cx = pos.x - (cat.width / 2);
    const cy = pos.y - pos.lineHeight - 8; // place above caret by default
    cat.style.left = `${Math.round(cx)}px`;
    cat.style.top = `${Math.round(cy)}px`;
    cat.style.transform = 'translateY(-6px)';
    cat.style.opacity = '1';
    // auto-hide after 900ms
    clearTimeout(cat._hideT);
    cat._hideT = setTimeout(hideCat, 900);
  }

  function hideCat() {
    cat.style.opacity = '0';
    cat.style.transform = 'translateY(0)';
  }

  // quickly attach to existing elements
  function attachToAll() {
    const textareas = Array.from(document.getElementsByTagName('textarea'));
    const inputs = Array.from(document.getElementsByTagName('input')).filter(i => i.type === 'text');
    const editables = Array.from(document.querySelectorAll('[contenteditable=""], [contenteditable="true"]'));
    for (const e of [...textareas, ...inputs, ...editables]) attachEditable(e);
  }

  // observe new editable elements being added
  const mo = new MutationObserver((mrs) => {
    for (const mr of mrs) {
      for (const node of mr.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.isContentEditable) attachEditable(node);
        if (node.tagName === 'TEXTAREA' || (node.tagName === 'INPUT' && node.type === 'text')) attachEditable(node);
        // also check descendants
        const ta = node.querySelectorAll ? node.querySelectorAll('textarea,input[type="text"],[contenteditable="true"],[contenteditable=""]') : [];
        for (const e of ta) attachEditable(e);
      }
    }
  });

  mo.observe(document.documentElement || document.body, { childList: true, subtree: true });

  // initial attach
  attachToAll();

  // also attach when focus enters an element (covers dynamic editors)
  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type === 'text'))) {
      attachEditable(t);
    }
  });
})();
