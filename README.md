# vdomx v0.0.5

Does for the DOM and VDOMs what JSX does for JavaScript. Adds interpolation and custom directives to your HTML.

# Usage

1) (optional) Load your front-end library that uses a virtual DOM, e.g. `preact`.
3) Compile your HTML containg template literals and attribute directives into a VDOMx object.
4) Render your VDOMx using attribute and state data plus a target HTMLElement or hand in an `h` function pass the results to a VDOM renderer, e.g. `preact`.


The example below can be found in the `examples` directory. You can also <a href="https://anywhichway.github.io/vdomx/examples/preact.html" target="_blank">try it out</a>. 

```html
<html>
<head>
<script src="https://cdn.jsdelivr.net/npm/preact/dist/preact.js"></script>
<script src="../index.js"></script>
</head>
<body>

<p>The template below would normally not be visible</p>
&lt;template id="message" style:style="${attributes[this].fontWeight}"&gt;
<br>&nbsp;&nbsp;Hello, ${name||"Anonymous"}!
<br>&nbsp;&nbsp;&lt;ul vx-forentries="${favorite-colors}"&gt;
<br>&nbsp;&nbsp;&nbsp;&nbsp;&lt;li style:style="color:${value}"&gt;${value}&lt;/li&gt;
<br>&nbsp;&nbsp;&lt;/ul&gt;
<br>&lt;/template&gt;
<template id="message">
	<p>Hello,<span style:style="font-weight:${attributes[this].fontWeight}">&nbsp;${name||"Anonymous"}!</span></p>
	<ul vx-forentries="${favoriteColors}">
		<li style:style="color:${value}">${value}</li>
	</ul>
</template>
<p>Below are the interpolated values rendered using preact and vdomx itself with {attributes:{style:{fontWeight:"bold"}},state:{name:"Joe",favoriteColors:["blue","green"]}} as the replacement object.</p>
<p><div id="preact"></div></p>
<p><div id="vdomx"></div></p>

<script>

const vdom = vdomx.compile(document.getElementById("message")),
	data = {attributes:{style:{fontWeight:"bold"}},state:{name:"Joe",favoriteColors:["blue","green"]}};
	
vdom.render(data,document.getElementById("vdomx"));

preact.render(vdom.render(data,preact.h),document.getElementById("preact"));

</script>

</body>
</html>
```

Note the use of `vx-forentries`, this is a smart directive that can take either an object or an array as an argument. The variables `entry`, `key`, `value`, `index` and `object` will be avilable to all template literals within scope. In the case of an array `key` and `index` will always have the same value, except `index` will be an integer. In the case of an object, `index` will be the position of the key in the object. `entry` will be an array of the from `[key,value]`. The scope is any DOM nodes lower in the tree than the element in which the directive is declared.

# API



# License

MIT

# Release History (reverse chronological order)

2018-07-01 v0.0.5 Simplified template resolution for components.

2018-06-27 v0.0.4 Corrected example directory structure.

2018-06-27 v0.0.3 Enhanced documentation and example.

2018-06-27 v0.0.2 All core functionality in place

2018-06-25 v0.0.1 Initial public release
