
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.head.appendChild(r) })(document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_update);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        if (component.$$.fragment) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, ret, value = ret) => {
                if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
                return ret;
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_update);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, detail));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    /* src/App.svelte generated by Svelte v3.12.1 */

    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	var nav, button0, span0, t0, div1, ul0, li0, a0, t1, span1, t3, li1, a1, t4, div0, a2, t6, a3, t8, form0, input0, t9, button1, t11, div2, img, t12, br, t13, h1, t15, h3, small, t17, div7, form1, div6, div3, label0, t19, input1, t20, div4, label1, t22, input2, t23, div5, t24, button2, t26, div8, ul1, dispose;

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			button0 = element("button");
    			span0 = element("span");
    			t0 = space();
    			div1 = element("div");
    			ul0 = element("ul");
    			li0 = element("li");
    			a0 = element("a");
    			t1 = text("Home ");
    			span1 = element("span");
    			span1.textContent = "(current)";
    			t3 = space();
    			li1 = element("li");
    			a1 = element("a");
    			t4 = space();
    			div0 = element("div");
    			a2 = element("a");
    			a2.textContent = "Dashboard (WIP)";
    			t6 = space();
    			a3 = element("a");
    			a3.textContent = "Logout";
    			t8 = space();
    			form0 = element("form");
    			input0 = element("input");
    			t9 = space();
    			button1 = element("button");
    			button1.textContent = "Search";
    			t11 = space();
    			div2 = element("div");
    			img = element("img");
    			t12 = space();
    			br = element("br");
    			t13 = space();
    			h1 = element("h1");
    			h1.textContent = "Hi";
    			t15 = space();
    			h3 = element("h3");
    			small = element("small");
    			small.textContent = "I'm your assignments app";
    			t17 = space();
    			div7 = element("div");
    			form1 = element("form");
    			div6 = element("div");
    			div3 = element("div");
    			label0 = element("label");
    			label0.textContent = "Assignment Content";
    			t19 = space();
    			input1 = element("input");
    			t20 = space();
    			div4 = element("div");
    			label1 = element("label");
    			label1.textContent = "Date";
    			t22 = space();
    			input2 = element("input");
    			t23 = space();
    			div5 = element("div");
    			t24 = space();
    			button2 = element("button");
    			button2.textContent = "Submit";
    			t26 = space();
    			div8 = element("div");
    			ul1 = element("ul");
    			attr_dev(span0, "class", "navbar-toggler-icon");
    			add_location(span0, file, 119, 8, 4596);
    			attr_dev(button0, "class", "navbar-toggler");
    			attr_dev(button0, "type", "button");
    			attr_dev(button0, "data-toggle", "collapse");
    			attr_dev(button0, "data-target", "#navbarSupportedContent");
    			attr_dev(button0, "aria-controls", "navbarSupportedContent");
    			attr_dev(button0, "aria-expanded", "false");
    			attr_dev(button0, "aria-label", "Toggle navigation");
    			add_location(button0, file, 117, 4, 4377);
    			attr_dev(span1, "class", "sr-only");
    			add_location(span1, file, 125, 50, 4855);
    			attr_dev(a0, "class", "nav-link");
    			attr_dev(a0, "href", "#");
    			add_location(a0, file, 125, 16, 4821);
    			attr_dev(li0, "class", "nav-item active");
    			add_location(li0, file, 124, 12, 4776);
    			attr_dev(a1, "class", "nav-link dropdown-toggle");
    			attr_dev(a1, "href", "#");
    			attr_dev(a1, "id", "navbarDropdown");
    			attr_dev(a1, "role", "button");
    			attr_dev(a1, "data-toggle", "dropdown");
    			attr_dev(a1, "aria-haspopup", "true");
    			attr_dev(a1, "aria-expanded", "false");
    			add_location(a1, file, 128, 16, 4975);
    			attr_dev(a2, "class", "dropdown-item disabled");
    			attr_dev(a2, "href", "/dashboard");
    			add_location(a2, file, 131, 20, 5241);
    			attr_dev(a3, "class", "dropdown-item");
    			attr_dev(a3, "href", "/logout");
    			add_location(a3, file, 132, 20, 5333);
    			attr_dev(div0, "class", "dropdown-menu");
    			attr_dev(div0, "aria-labelledby", "navbarDropdown");
    			add_location(div0, file, 130, 16, 5160);
    			attr_dev(li1, "class", "nav-item dropdown");
    			add_location(li1, file, 127, 12, 4928);
    			attr_dev(ul0, "class", "navbar-nav mr-auto");
    			add_location(ul0, file, 123, 8, 4732);
    			attr_dev(input0, "class", "form-control mr-sm-2");
    			attr_dev(input0, "type", "search");
    			attr_dev(input0, "placeholder", "Search");
    			attr_dev(input0, "aria-label", "Search");
    			add_location(input0, file, 137, 12, 5499);
    			attr_dev(button1, "class", "btn btn-outline-primary my-2 my-sm-0");
    			attr_dev(button1, "type", "button");
    			attr_dev(button1, "onclick", "alert('Search not implemented yet')");
    			add_location(button1, file, 138, 12, 5603);
    			attr_dev(form0, "class", "form-inline my-2 my-lg-0");
    			add_location(form0, file, 136, 8, 5447);
    			attr_dev(div1, "class", "collapse navbar-collapse");
    			attr_dev(div1, "id", "navbarSupportedContent");
    			add_location(div1, file, 122, 4, 4657);
    			attr_dev(nav, "class", "navbar navbar-expand-lg navbar-light bg-light");
    			add_location(nav, file, 116, 0, 4313);
    			attr_dev(img, "class", "profile mt-2");
    			attr_dev(img, "src", "images/noteLogo.png");
    			attr_dev(img, "alt", "Application Logo");
    			add_location(img, file, 145, 4, 5839);
    			add_location(br, file, 148, 4, 5937);
    			attr_dev(h1, "class", "display-3");
    			add_location(h1, file, 149, 4, 5946);
    			attr_dev(small, "class", "text-muted");
    			add_location(small, file, 153, 8, 6007);
    			add_location(h3, file, 152, 4, 5994);
    			attr_dev(div2, "class", "container text-center");
    			add_location(div2, file, 144, 0, 5799);
    			attr_dev(label0, "for", "inputAssignment");
    			add_location(label0, file, 160, 16, 6235);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "class", "form-control col-12");
    			attr_dev(input1, "id", "inputAssignment");
    			attr_dev(input1, "aria-", "");
    			attr_dev(input1, "placeholder", "Enter Assignment");
    			add_location(input1, file, 161, 16, 6307);
    			attr_dev(div3, "class", "form-group");
    			add_location(div3, file, 159, 12, 6194);
    			attr_dev(label1, "for", "inputDate");
    			add_location(label1, file, 165, 16, 6508);
    			attr_dev(input2, "type", "date");
    			attr_dev(input2, "class", "form-control col-12");
    			attr_dev(input2, "id", "inputDate");
    			attr_dev(input2, "aria-", "");
    			attr_dev(input2, "placeholder", "Enter Assignment");
    			add_location(input2, file, 166, 16, 6560);
    			attr_dev(div4, "class", "form-group");
    			add_location(div4, file, 164, 12, 6467);
    			attr_dev(div5, "class", "w-100");
    			add_location(div5, file, 168, 12, 6691);
    			attr_dev(button2, "id", "add");
    			attr_dev(button2, "class", "btn btn-primary col-6");
    			add_location(button2, file, 169, 12, 6729);
    			attr_dev(div6, "class", "row justify-content-around");
    			add_location(div6, file, 158, 8, 6141);
    			attr_dev(form1, "action", "");
    			add_location(form1, file, 157, 4, 6116);
    			attr_dev(div7, "class", "container mt-3");
    			add_location(div7, file, 156, 0, 6083);
    			attr_dev(ul1, "class", "list-group mt-3");
    			attr_dev(ul1, "id", "notesContainer");
    			add_location(ul1, file, 174, 4, 6872);
    			attr_dev(div8, "class", "container");
    			add_location(div8, file, 173, 0, 6844);
    			dispose = listen_dev(button2, "click", submit);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, button0);
    			append_dev(button0, span0);
    			append_dev(nav, t0);
    			append_dev(nav, div1);
    			append_dev(div1, ul0);
    			append_dev(ul0, li0);
    			append_dev(li0, a0);
    			append_dev(a0, t1);
    			append_dev(a0, span1);
    			append_dev(ul0, t3);
    			append_dev(ul0, li1);
    			append_dev(li1, a1);
    			append_dev(li1, t4);
    			append_dev(li1, div0);
    			append_dev(div0, a2);
    			append_dev(div0, t6);
    			append_dev(div0, a3);
    			append_dev(div1, t8);
    			append_dev(div1, form0);
    			append_dev(form0, input0);
    			append_dev(form0, t9);
    			append_dev(form0, button1);
    			insert_dev(target, t11, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, img);
    			append_dev(div2, t12);
    			append_dev(div2, br);
    			append_dev(div2, t13);
    			append_dev(div2, h1);
    			append_dev(div2, t15);
    			append_dev(div2, h3);
    			append_dev(h3, small);
    			insert_dev(target, t17, anchor);
    			insert_dev(target, div7, anchor);
    			append_dev(div7, form1);
    			append_dev(form1, div6);
    			append_dev(div6, div3);
    			append_dev(div3, label0);
    			append_dev(div3, t19);
    			append_dev(div3, input1);
    			append_dev(div6, t20);
    			append_dev(div6, div4);
    			append_dev(div4, label1);
    			append_dev(div4, t22);
    			append_dev(div4, input2);
    			append_dev(div6, t23);
    			append_dev(div6, div5);
    			append_dev(div6, t24);
    			append_dev(div6, button2);
    			insert_dev(target, t26, anchor);
    			insert_dev(target, div8, anchor);
    			append_dev(div8, ul1);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(nav);
    				detach_dev(t11);
    				detach_dev(div2);
    				detach_dev(t17);
    				detach_dev(div7);
    				detach_dev(t26);
    				detach_dev(div8);
    			}

    			dispose();
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment.name, type: "component", source: "", ctx });
    	return block;
    }

    function submit(e) {
        e.preventDefault();
        const inputText = document.getElementById('inputAssignment').value;
        const inputDate = document.getElementById('inputDate').value;
        const json = {Note: inputText, Date: inputDate};
        postData(json, 'submit');
    }

    function postData(json, path) {
        (async () => {
            const rawResponse = await fetch(path, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(json)
            });
            const content = await rawResponse.json();
            handleData(content);
        })();
    }

    function handleData(data) {
        let container = document.getElementById("notesContainer");//.empty()
        let id = 1;
        data.forEach(function (item, index, array) {
            let note = document.createElement("li");
            note.innerHTML = createInnerHTML(item, id);
            note = setClassName(note, item, id);
            id++;
            container.insertAdjacentElement('beforeend', note);
        });
    }

    function setClassName(note, item, id) {
        if (item.Days <= 5) {
            note.className = "list-group-item d-flex list-group-item-danger item-" + id + " justify-content-between";
        } else {
            note.className = "list-group-item d-flex list-group-item-success item-" + id + " justify-content-between";
        }
        return note
    }

    function createInnerHTML(item, id) {
        let itemId = "\"" + item._id + "\"";
        return "<p class='p-0 m-0 flex-grow-1' id='item-" + id + "'>" +
            item.Note +
            " due: " + item.Date +
            " days: " + item.Days +
            "</p>" +
            "<button class='btn btn-success mr-1' onClick='editItem(" + id + "," + itemId + ")'>edit</button>" +
            "<button class='btn btn-danger' onClick='deleteItem(" + itemId + ")'>delete</button>"
    }

    function instance($$self) {
    	

        (function getUsername() {
            (async () => {
                const rawResponse = await fetch("/username", {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                });
                const content = await rawResponse.json();
                console.log(content);
                document.getElementById("navbarDropdown").html("User " + content);
            })();
        })();
        document.onload = postData({}, 'refresh');

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {};

    	return {};
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "App", options, id: create_fragment.name });
    	}
    }

    const app = new App({
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
