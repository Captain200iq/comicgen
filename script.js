/* globals hljs, ClipboardJS, showdown */
/* TODO
- URL should match code. e.g. go to biden, change colors, go to ava. Biden's colors are in URL
*/
async function init() {
  const response = await fetch('dist/characterlist.json')
  const chars = await response.json()

  // Return the menu dropdowns given a selection (q).
  // Result = {label: [option, option, ...], label: [...]}
  const options = function (q) {
    let result = { name: Object.keys(chars) }
    const char = chars[q.name] || Object.values(chars)[0]
    char.patterns.forEach(pattern => {
      let node = char.files
      // Split each pattern by "/" like the directory structure
      for (const dir of pattern.split(/\s*\/\s*/)) {
        // (Recursively) loop through each directory
        if (dir.match(/\{/)) {
          // If dir is a variable (e.g. "{face}" or "{face}.svg"), get all matching keys, filter by current/first option
          let key = dir.slice(1, -1)
          result[key] = Object.keys(node)
          node = node[q[key]] || Object.values(node)[0]
        } else {
          // If dir is a value (e.g. "face"), filter all nodes
          node = node[dir]
        }
      }
    })
    return result
  }

  const menu_template = _.template(document.querySelector('#menu-template').innerHTML)
  const code_template = _.template(document.querySelector('#codegen').innerHTML)
  const $codetemp = document.querySelector('#codetemp')
  const $menu = document.querySelector('#menu')
  const $character = document.querySelector('#character .target')
  // ID of the dropdown that last triggered a change. Useful to re-focus on it if menu is redrawn
  let trigger_id = ''
  // Current background color. When the menu is redrawn, preserve this color on the page
  let state = { bgcolor: '#ffffff' }
  const config = {
    typeclass: {
      color: 'form-control-color',
      number: 'form-control-number'
    }
  }

  function getParams() {
    let params = new URLSearchParams()
    for (let node of $menu.querySelectorAll('select, input'))
      params.append(node.name, node.value)
    return params
  }

  function bg_color(e) {
    if (e.target.classList.contains('bg-color'))
      // The first rule in the first sheet defines the background color for the target-container
      state.bgcolor = document.styleSheets[0].cssRules[0].style.backgroundColor = e.target.value
  }

  // Render the document based on query parameters
  async function render() {
    let q = g1.url.parse(location.hash.replace(/^#/, '?')).searchKey
    // If the name has changed, re-render the menu (WHY?)
    $menu.innerHTML = menu_template({ q, chars, config, options: options(q) })
    let params = getParams()
    const response = await fetch('comic?' + params)
    $character.innerHTML = await response.text()
    $codetemp.innerHTML = code_template({ url: location.origin + location.pathname + 'comic?' + params || '', state, code_template })
    if (trigger_id)
      document.querySelector(`#${trigger_id}`).focus()
  }

  // When location hash changes (or initially), re-render
  window.addEventListener('hashchange', render, false)
  render()

  // When inputs change, change location hash -- but no oftener than 200ms
  let delay = 200
  let lastUpdated = 0
  let event, timeout
  $menu.addEventListener('input', e => {
    event = { hash: getParams(), id: e.target.id }
    let diff = +new Date() - lastUpdated
    if (diff < delay) {
      if (timeout)
        clearTimeout(timeout)
      timeout = setTimeout(updateURL, diff)
      return
    }
    updateURL()
  })

  function updateURL() {
    location.hash = event.hash
    trigger_id = event.id
    lastUpdated = +new Date()
  }

  document.body.addEventListener('input', bg_color, false)
  document.body.addEventListener('change', bg_color, false)

  new ClipboardJS('.copy')
}
init()

// Render part of README.md as Markdown. Sections delimited by <!-- var ... !>...<!-- end -->
$.get('README.md')
  .done(function (text) {
    let converter = new showdown.Converter({ ghCodeBlocks: true, tables: true })
    text.match(/<!--\s*var\s+\S*\s*-->[\s\S]*?<!--\s*end\s*-->/igm).forEach(function (match) {
      let lines = match.split(/\n/)
      let name = lines[0].replace(/^<!--\s*var\s+/, '').replace(/\s*-->$/, '')
      $('md[data-target="' + name + '"]')
        .addClass('d-block my-4')
        .html(converter.makeHtml(lines.slice(1, -1).join('\n')))
        .find('pre')
        .each(function () { hljs.highlightBlock(this) })
    })
    $('md table').addClass('table table-sm')
      .find('a').each(function () {
        $(this).attr('target', '_blank')
      })
  })
