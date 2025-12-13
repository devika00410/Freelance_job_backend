// check-route.js - Run in your backend
const app = require('./index.js'); // or your main server file

console.log('🔍 Checking all registered routes...\n');

function printRoutes(path, layer) {
    if (layer.route) {
        layer.route.stack.forEach(printRoutes.bind(null, path.concat(split(layer.route.path))));
    } else if (layer.name === 'router' && layer.handle.stack) {
        layer.handle.stack.forEach(printRoutes.bind(null, path.concat(split(layer.regexp))));
    } else if (layer.method) {
        console.log(`${layer.method.toUpperCase()} ${path.concat(split(layer.regexp)).filter(Boolean).join('/')}`);
    }
}

function split(thing) {
    if (typeof thing === 'string') {
        return thing.split('/');
    } else if (thing.fast_slash) {
        return '';
    } else {
        var match = thing.toString()
            .replace('\\/?', '')
            .replace('(?=\\/|$)', '$')
            .match(/^\/\^((?:\\[.*+?^${}()|[\]\\\/]|[^.*+?^${}()|[\]\\\/])*)\$\//);
        return match
            ? match[1].replace(/\\(.)/g, '$1').split('/')
            : '<complex:' + thing.toString() + '>';
    }
}

app._router.stack.forEach(printRoutes.bind(null, []));