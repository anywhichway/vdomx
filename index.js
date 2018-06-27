(function() {
	
	const BOOLEANATTRIBUTE = ["checked","disabled","hidden","multiple","nowrap","selected","required","open"];
	
	function deepCopy(o) {
		 const output = Array.isArray(o) ? o : Object.create(Object.getPrototypeOf(o));// need to handle Date, etc.
	   for (const key in o) {
	       const v = o[key];
	       try {
	      	 output[key] = (v && typeof(v)==="object") ? deepCopy(v) : v; 
	       } catch(e) { ; }
	   }
	   return output;
	}
	
	function interpolate(strings,...values) {
		//const type = typeof[values[0]];
		if(strings.every(string => string.length===0) && values.length>0) return values[0]; //  type==="function" || (values[0] && type==="object")) 
		return strings.reduce((accum,string,i) => accum += (i<values.length ? (string + values[i]) : string),"");
	}
	
	function realize(vnode,node,parent) { // map the vnode into the DOM
		const type = typeof(vnode);
		let append;
		if(vnode && type==="object") {
			if(!node) {
				node = append = document.createElement(vnode.nodeName);
			} else if(node.nodeName.toLowerCase()!==vnode.nodeName) {
				const newnode = document.createElement(vnode.nodeName);
				node.parentNode.replaceChild(newnode,node);
				if(node.id) newnode.id = node.id;
				node = newnode;
			}
			if(node.attributes) {
				const remove = [];
				for(let i=0;i<node.attributes.length;i++) {
					const attribute = node.attributes[i];
					if(!vnode.attributes[attribute.name]) remove.push(attribute.name);
				}
				while(remove.length>0) node.removeAttribute(remove.pop());
			}
			setAttributes(node,vnode);
			while(node.childNodes.length>vnode.children.length) node.removeChild(node.lastChild);
			vnode.children.forEach((child,i) => {
				if(child) realize(child,node.childNodes[i],node);
			});
		} else {
			if(!node) {
				node = append = new Text(vnode);
			} else if(node instanceof Text){
				if(node.data!==vnode) node.data = vnode;
			} else {
				parent = node;
				append = new Text(vnode);
			}
		}
		if(parent && append) parent.appendChild(append);
		return node;
	}
	
	function setAttributes(element,vnode) {
		for(const aname in vnode.attributes) {
			const value  = vnode.attributes[aname];
			if(aname==="style" && value && typeof(value)==="object") value = Object.keys(value).reduce((accum,key) => accum += `${key}:${value};`);
			if(!BOOLEANATTRIBUTE.some(name => name===aname && falsy(value))) {
				const type = typeof(value);
				if(type==="function" || (value && type==="object")) element[aname] = value;
				else {
					element.setAttribute(aname,value);
					if(["checked","selected","value"].includes(aname) && element[aname]!==value) element[aname] = value;
				}
			}
		}
		if(vnode.key && !vnode.attributes.id) element.id = vnode.key;
		return element;
	}
	
	const DIRECTIVES = {
			"vx-if": function(children,value) {
				if(this==="true") return children;
				return [];
			},
			"vx-foreach": function(children,array) {
				const me = this,
					newchildren = [];
				let f;
				if(typeof(this)==="function") {
					f = this;
				}
				array.forEach((value,index,array) => {
					children.forEach((child,i) => {
						const type = typeof(child);
						if(f) newchildren[index+i] = f(child);
						else if(type==="string") {
							newchildren[i] = Function("value","index","array","return `" + child + "`")(value,index,array);
						} else if(child && type==="object") {
							let aux = function(child) {
								if(typeof(child)==="string") {
									return Function("value","index","array","return `" + child + "`")(value,index,array);
								}
								const copy = deepCopy(child);
								Object.keys(child.attributes).forEach(key => {
									let avalue = child.attributes[key],
										scope = {};
									if(key.includes(":")) {
										const parts = key.split(":");
										key = parts[0];
										scope = parts[1];
										try {
											scope = Function("interpolate","return `" + scope + "`")(interpolate);
											delete copy.attributes[parts.join(":")];
										} catch(e) { ; }
									}
									copy.attributes[key] = 
										Function("value","index","array","interpolate","with(this){with(value){return interpolate`" + avalue + "`}}").call(scope,value,index,array,interpolate);
								});
								copy.children = child.children.map(child => aux(child));
								return copy;
							}
							aux = aux.bind(me);
							newchildren[index+i] = aux(child);
						}
					});
				});
				return newchildren;
			},
			"vx-map": function(children,value) {
				return children.map(value.bind(this));
			}
	}
	
	function vdom(node) {
		if(!(this instanceof vdom)) return new vdom(node);
		const type = typeof(node);
		if(node && type==="object") {
			this.nodeName = node.tagName.toLowerCase();
			this.attributes = {};
			this.children = [];
			for(const attr of [].slice.call(node.attributes)) {
				this.attributes[attr.name] = node[attr.name] || attr.value;
			}
			for(const child of [].slice.call(node.childNodes)) {
				if(child instanceof Text) {
					let text = child.textContent;
					if(text.length>1) text = text.trim();
					if(text.length>0) this.children.push(text);
				} else {
					this.children.push(new vdom(child));
				}
			}
			return this;
		}
	}
	vdom.prototype.render = function(data,target={},options={}) {
		if(!(target instanceof HTMLElement)) {
			options = target;
			target = {};
		}
		directives = Object.assign({},DIRECTIVES,options.customDirectives);
		const vnode = {nodeName:this.nodeName,attributes:{},children:[]};
		let children = this.children;
		for(let key in this.attributes) {
			let scope,
				value = this.attributes[key];
			if(key.includes(":")) {
				const parts = key.split(":");
				key = parts[0];
				scope = parts[1];
				try {
					scope = Function("interpolate","with(this){return `" + scope + "`}").call(data,interpolate);
				} catch(e) { ; }
			}
			value = Function("data","interpolate","with(this){with(data){with(data.state||{}){return interpolate`" + value + "`}}}")
				.call(scope,data,interpolate);
			if(key.indexOf("vx-")===0) {
				if(directives[key]) {
					children = vnode.children = directives[key].bind(scope||{})(deepCopy(children),value);
				}
			}
			vnode.attributes[key] = value;
		}
		if(children===this.children) {
			for(let child of children) {
				if(typeof(child)==="string") {
					vnode.children.push(Function("with(this){with(this.state||{}){{ return `" + child + "`}}}").call(data));
				} else  {
					vnode.children.push(child.render(data,options));
				}
			}
		}
		if(target instanceof HTMLElement) {
			Object.defineProperty(target,"render",{enumerable:false,configurable:true,writable:true,value:this.render.bind(this)});
			realize(vnode,target);
		}
		return vnode;
	}
	
	const vdomx = (node,state,directives) => {
		return vdomx.compile(node).render(state,directives);
	}
	vdomx.compile = (node) => {
		if(node.tagName==="TEMPLATE") {
			const el = document.createElement("div");
			el.innerHTML = node.innerHTML;
			for(const attr of [].slice.call(node.attributes)) {
				if(attr.name!=="id") el.setAttribute(attr.name,attr.value);
			}
			node = el;
		}
		return new vdom(node);
	}
	
	if(typeof(module)!=="undefined") module.vdomx = vdomx;
	if(typeof(window)!=="undefined") window.vdomx = vdomx;
}).call(this);