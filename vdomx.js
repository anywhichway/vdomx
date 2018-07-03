/* Copyright 2018 AnyWhichWay, LLC

	Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
	documentation files (the "Software"), to deal in the Software without restriction, including without limitation
	the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
	and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
	Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
	THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
	TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
	*/
(function() {
	"use strict";
	const BOOLEANATTRIBUTE = ["checked","disabled","hidden","multiple","nowrap","selected","required","open"];
	
	function Component(f,name=f.name) {
		if(!(this instanceof Component)) return new Component(f,name);
		if(!f) f = this.render;
		const component = (attributes={},state={},options) => {
			const vdom = f(attributes,state);
			vdom.state = state;
			for(const key in component) {
					if(key[0]==="o" && key[1]==="n") {
						if(!vdom.attributes[key]) vdom.attributes[key] = component[key];
					} else {
						Object.defineProperty(vdom,key,{enumerable:false,configurable:true,writable:true,value:component[key]})
					}
			}
			for(const key in this) {
				Object.defineProperty(vdom,key,{enumerable:false,configurable:true,writable:true,value:this[key]})
			}
			Object.defineProperty(vdom,"resolve",{enumerable:false,configurable:true,writable:true,value:(attributes,state,options) => {
				return component(attributes,state,options);
			}});
			return vdom;
		}
		Component.instances[name.toLowerCase()] = component;
		return component;
	}
	Component.prototype = new Function();
	
	Component.instances = {};
	const deepCopy = o => {
		 const output = Array.isArray(o) ? o : Object.create(Object.getPrototypeOf(o));// need to handle Date, etc.
	   for (const key in o) {
	       const v = o[key];
	       try {
	      	 output[key] = (v && typeof(v)==="object") ? deepCopy(v) : v; 
	       } catch(e) { ; }
	   }
	   return output;
		},
		interpolate = (strings,...values) => {
			if(strings.every(string => string.length===0) && values.length>0) return values[0];
			return strings.reduce((accum,string,i) => accum += (i<values.length ? (string + values[i]) : string),"");
		},
		merge = (state,target) => {
			if(state && typeof(state)==="object") {
				for(const key in state) {
					const value = state[key];
					if(value==null) {
						delete target[key];
					} else if(typeof(value)==="object") {
						if(!target[key] || typeof(target[key])!=="object") target[key] = {};
						merge(value,target[key]);
					} else {
						target[key] = value;
					}
				}
			}
		},
		realize = (vnode,node,parent) => { // map the vnode into the DOM
			let append;
			if(vnode && vnode.nodeName==="script") return node;
			if(vnode && typeof(vnode)==="object") {
				if(!node) {
					node = append = document.createElement(vnode.nodeName);
					if(vnode.attributes.oncreate) vnode.attributes.oncreate(node);
				} else if(node.nodeName.toLowerCase()!==vnode.nodeName) {
					const newnode = document.createElement(vnode.nodeName);
					node.parentNode.replaceChild(newnode,node);
					if(node.ondestroy) node.ondestroy(node);
					if(node.id) newnode.id = node.id;
					node = newnode;
					if(vnode.attributes.oncreate) vnode.attributes.oncreate(node);
				}
				if(node.attributes) {
					const remove = [],
						attributes = [].slice.call(node.attributes);
					for(let i=0;i<attributes.length;i++) {
						const attribute = attributes[i];
						if(!vnode.attributes[attribute.name]) remove.push(attribute.name);
					}
					while(remove.length>0) {
						const aname = remove.pop(),
							oldvalue = node.getAttribute(aname);
						node.removeAttribute(aname);
						if(node.attributes.onupdate) node.attributes.onupdate(node,aname,oldvalue);
					}
				}
				setAttributes(node,vnode);
				while(node.childNodes.length>vnode.children.length) node.removeChild(node.lastChild);
				vnode.children.forEach((child,i) => {
					if(child) {
						const cnode = realize(child,node.childNodes[i],node);
						if(!cnode.setState) {
							if(parent && parent.setState) Object.defineProperty(cnode,"setState",{enumerable:true,configurable:true,writable:true,value:parent.setState.bind(parent)});
							else Object.defineProperty(cnode,"setState",{enumerable:true,configurable:true,writable:true,value:vnode.setState.bind(vnode)});
						}
					}
				});
				if(!parent) Object.defineProperty(node,"setState",{enumerable:true,configurable:true,writable:true,value:vnode.setState.bind(vnode)});
				vnode.node = node;
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
		},
		resolveAttributes = (node,attributes,state,directives) => {
			attributes = Object.assign({},attributes);
			for(let key in attributes) {
				let scope,
					value = attributes[key];
				if(typeof(value)==="string") {
					if(key.includes(":")) {
						const parts = key.split(":");
						key = parts[0];
						scope = parts[1];
						try {
							scope = Function("interpolate","with(node){return `" + scope + "`}").call(state,interpolate);
						} catch(e) { ; }
					}
					if(key.indexOf("data-")===0) {
						const parts = key.split("-");
						parts.shift();
						const dkey = parts.shift() + parts.reduce((accum,part) => accum += (part[0].toUpperCase() + part.substring(1)),"");
						state[dkey] = Function("state","interpolate","with(state){return interpolate`" + value + "`}")(state,interpolate);
						delete attributes[key];
					} else {
						try {
							value = Function("state","interpolate","with(this){with(state){return interpolate`" + value + "`}}")
								.call(scope,state,interpolate);
							} catch(e) { ; }
							attributes[key] = value;
							if(key.indexOf("vx-")===0) {
								if(directives[key]) {
									node.children = directives[key].bind(node)(attributes,deepCopy(node.children),key,value,scope);
								}
							}
					}
				}
			}
			return attributes;
		},
		setAttributes = (element,vnode) => {
			for(const aname in vnode.attributes) {
				const value  = vnode.attributes[aname];
				if(aname==="style" && value && typeof(value)==="object") value = Object.keys(value).reduce((accum,key) => accum += `${key}:${value};`);
				if(!BOOLEANATTRIBUTE.some(name => name===aname && falsy(value))) {
					const type = typeof(value);
					let oldvalue = element.getAttribute(aname);
					if(type==="function" || (value && type==="object")) {
						oldvalue = element[aname] || oldvalue;
						if(oldvalue!==value) {
							element[aname] = value;
							if(vnode.attributes.onupdate) vnode.attributes.onupdate(element,aname,oldvalue);
						}
					}
					else if(oldvalue!==value) {
						element.setAttribute(aname,value);
						if(vnode.attributes.onupdate) vnode.attributes.onupdate(element,aname,oldvalue);
						if(["checked","selected","value"].includes(aname) && element[aname]!==value) element[aname] = value;
					}
				}
			}
			if(vnode.key && !vnode.attributes.id) element.id = vnode.key;
			return element;
		},
		DIRECTIVES = {
			"vx-if": function(attributes,children,attributeName,value) {
				if(value) return children;
				return [];
			},
			"vx-forentries": function(attributes,children,attributeName,object,extras) { //{var:<var>,in:<object>,of:<array>} [index,while,next]
				const me = this,
					newchildren = [],
					vname = extras.value,
					oname = extras.object;
				let f;
				if(typeof(this)==="function") {
					f = this;
				}
				Object.entries(object).forEach((entry,index) => {
					const [key,value] = entry;
					children.forEach((child,i) => {
						const type = typeof(child);
						if(f) newchildren[index+i] = f(child);
						else if(type==="string") {
							newchildren[i] = Function("interpolate","entry","key","value","index","object",vname,oname,"return interpolate`" + child + "`")(interpolate,entry,key,value,index,object,value,object);
						} else if(child && type==="object") {
							let aux = function(child) {
								if(typeof(child)==="string") {
									return Function("interpolate","entry","key","value","index","object",vname,oname,"return interpolate`" + child + "`")(interpolate,entry,key,value,index,object,value,object);
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
										Function("interpolate","entry","key","value","index","object",vname,oname,"with(this){return interpolate`" + avalue + "`}").call(scope,interpolate,entry,key,value,index,object,value,object);
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
			"vx-on": function(attributes,children,attributeName,value,extra) {
				attributes["on"+extra] = Function("return " + value)();
				return children;
			}
		};
	function vdom(node,options={}) {
		if(!(this instanceof vdom)) return new vdom(node,options);
		this.options = Object.assign({},options);
		if(node && typeof(node)==="object") {
			let template = false;
			if(node.tagName==="TEMPLATE") {
				template = true;
				const el = document.createElement("div");
				el.innerHTML = node.innerHTML;
				for(const attr of [].slice.call(node.attributes)) {
					if(attr.name!=="id") el.setAttribute(attr.name,attr.value);
				}
				node = el;
			}
			const tagname = node.getAttribute("vx-tagname");
			Object.assign(this,{nodeName:tagname ? "div" : node.tagName.toLowerCase(),attributes:{},children:[]});
			for(const attr of [].slice.call(node.attributes)) this.attributes[attr.name] = node[attr.name] || attr.value;
			for(const child of [].slice.call(node.childNodes)) {
				if(child instanceof Text) {
					if(child.textContent.trim().length>0) this.children.push(child.textContent);
				} else {
					this.children.push(new vdom(child,options));
				}
			}
			if(tagname && template) {
				const f = (attributes,state,options) => this.resolve(attributes,state,options);
				Component(f,tagname.toLowerCase());
			}
			return this;
		}
	}
	vdom.prototype.render = function(state,target,attributes,options={}) {
		target || (target = this.node || document.body);
		if(attributes) this.attributes = Object.assign({},attributes);
		if(options) this.options = Object.assign({},options);
		const vnode = this.resolve(attributes,state,options);
		Object.defineProperty(target,"render",{enumerable:false,configurable:true,writable:true,value:(state,attributes=vnode.attributes) => this.render(state,target,attributes,options)});
		Object.defineProperty(vnode,"setState",{enumerable:false,configurable:true,writable:true,value:this.setState.bind(this)});
		realize(vnode,target);
		return vnode;
	}
	vdom.prototype.resolve = function(attributes={},state,options={}) {
		const h = options.h || vdomx.h,
			directives = Object.assign({},DIRECTIVES,options.directives);
		if(Component.instances[this.nodeName]) return Component.instances[this.nodeName](resolveAttributes(this,attributes,state,directives),state,options)
		const vnode = h(this.nodeName,resolveAttributes(this,attributes,state,directives),[]);
		if(state) this.state = Object.assign({},state);
		for(let child of this.children) {
			if(typeof(child)==="string") {
				if(vnode.nodeName!=="script") { 
					try {
						child = Function("with(this){return `" + child + "`}").call(state);
					} catch(e) { ; }
				}
				vnode.children.push(child);
			} else  {
				vnode.children.push(child.resolve(child.attributes,state,options));
			}
		}
		return vnode;
	}
	vdom.prototype.setState = function(state) {
		if(!this.state) this.state = {};
		merge(state,this.state);
		if(this.node) this.render(this.state,this.node,this.attributes,this.options);
	}
	const vdomx = (node,state,directives) => {
		return vdomx.compile(node).render(state,directives);
	}
	vdomx.compile = function(node=document.body,options={}) {
		if(arguments.length===0) this.compile(document.head);
		return new vdom(node);
	}
	vdomx.Component = Component;
	vdomx.h = (nodeName,attributes={},...children) => {
		const vnode = Object.create(vdom.prototype); //{nodeName,attributes};
		vnode.nodeName = nodeName;
		vnode.attributes = Object.assign({},attributes);
		if(children.length===1) {
			if(Array.isArray(children[0])) children = children[0].slice();
			else children = [children[0]];
		}
		vnode.children = children;
		return vnode;
	}
	if(typeof(module)!=="undefined") module.vdomx = vdomx;
	if(typeof(window)!=="undefined") window.vdomx = vdomx;
}).call(this);