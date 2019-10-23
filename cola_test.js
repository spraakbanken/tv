

  document.body.innerHTML = `
  <style>
  .node {
    stroke: #fff;
    stroke-width: 1.5px;
  }

  .link {
    fill: none;
    stroke: #000;
    stroke-width: 1.5px;
    opacity: 0.4;
    marker-end: url(#end-arrow);
  }

  .group {
      stroke: #fff;
      stroke-width: 1.5px;
      opacity: 0.2;
  }
  </style>
  `

  console.log(cola, d3)

      var width = 960,
          height = 500;

      var color = d3.scaleOrdinal(d3.schemeCategory20);

      var d3cola = cola.d3adaptor(d3)
          // .avoidOverlaps(true)
          .size([width, height]);

      var svg = d3.select("body").append("svg")
          .attr("width", width)
          .attr("height", height);

      const now = k => k()
      // d3.json("static/chris.json", function (error, graph) {
      now(() => {

          function make_graph(nodes, links, groups, x_align) {
            const pos = {}
            const node = x => pos[x]
            return {
              nodes: nodes.trim().split(/\s+/mg).map((name, i) => {
                pos[name] = i
                return {name}
              }),
              links: links.trim().split(/\s+/mg).map(e => {
                const [s, t] = e.split('-')
                return {source: node(s), target: node(t), value: 1}
              }),
              groups: groups.trim().split(/\s+/mg).map(g => {
                const nodes = g.split(/-/g)
                return {id: g, leaves: nodes.map(node), padding: 15}
              }),
              constraints: x_align.trim().split(/\s+/mg).map(g => {
                const [l, r] = g.split(/-/g)
                return {
                  // type: 'separation',
                  axis: 'x',
                  left: node(l),
                  right: node(r),
                  gap: 25
                  // offsets: nodes.map(n => ({node: node(n), offset: 0}))
                }
              })  .concat(x_align.trim().split(/\s+/mg).map(g => {
                const [l, r] = g.split(/-/g)
                return {
                  // type: 'separation',
                  axis: 'y',
                  left: node(l),
                  right: node(r),
                  gap: 0,
                  equality: true
                  // offsets: nodes.map(n => ({node: node(n), offset: 0}))
                }
              }))
            }
          }

          const nodes = `
                a
             b      e
            c x d    f g
          `

          const links = `
            a-b             a-e
            b-c e-x b-d   e-f e-g
          `

          const groups_desc = `
            f-g
          `

          const x_align = `
            b-e
            c-x x-d d-f f-g
          `

          // const graph = make_graph(nodes, links, groups_desc, x_align)

          const graph = make_graph(
            `1 2

                y

              x        a
                b          Y

                       X
            `,
            `y-b b-Y x-a a-X`,
            `y-b-b-Y x-a-a-X y-b`,
            `1-2`)


          var nodeRadius = 5;

          graph.nodes.forEach(function (v) { v.height = v.width = 2 * nodeRadius; });

          console.clear()
          console.log(graph)
          console.log(JSON.stringify(graph.groups.map(g => g.leaves)))

          d3cola
              .nodes(graph.nodes)
              .links(graph.links)
              .groups(graph.groups || [])
              // .constraints(graph.constraints || [])
              .avoidOverlaps(true)
              // .linkDistance(80) // d => 10 * (2 + d.source + d.target) + d.value)
              // .flowLayout("y", 35)
              .symmetricDiffLinkLengths(30)
              // .jaccardLinkLengths(55, 8)
              // .convergenceThreshold(0.01)
              // .tick()
              .start(50, 50, 50);

          // d3cola.avoidOverlaps(false);

          // define arrow markers for graph links
          svg.append('svg:defs').append('svg:marker')
              .attr('id', 'end-arrow')
              .attr('viewBox', '0 -5 10 10')
              .attr('refX', 6)
              .attr('markerWidth', 3)
              .attr('markerHeight', 3)
              .attr('orient', 'auto')
            .append('svg:path')
              .attr('d', 'M0,-5L10,0L0,5')
              .attr('fill', '#000');

          var group = svg.selectAll('.group')
                  .data(graph.groups)
                  .enter().append('rect')
                  .classed('group', true)
                  .attr('rx',5)
                  .attr('ry',5)
                  .style("fill", function (d) { return color(d.id); })
                  .call(d3cola.drag);


          var path = svg.selectAll(".link")
              .data(graph.links)
            .enter().append('svg:path')
              .attr('class', 'link');

          var node = svg.selectAll(".node")
              .data(graph.nodes)
            .enter().append("circle")
              .attr("class", "node")
              .attr("r", nodeRadius)
              .style("fill", function (d) { return color(d.group); })
              .call(d3cola.drag);

          node.append("title")
              .text(function (d) { return d.name; });

          d3cola.on("tick", function () {
              console.log('tick')
              // draw directed edges with proper padding from node centers
              path.attr('d', function (d) {
                  var deltaX = d.target.x - d.source.x,
                      deltaY = d.target.y - d.source.y,
                      dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
                      normX = deltaX / dist,
                      normY = deltaY / dist,
                      sourcePadding = nodeRadius,
                      targetPadding = nodeRadius + 2,
                      sourceX = d.source.x + (sourcePadding * normX),
                      sourceY = d.source.y + (sourcePadding * normY),
                      targetX = d.target.x - (targetPadding * normX),
                      targetY = d.target.y - (targetPadding * normY);
                  return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
              });

              group
                  .attr('x', function (d) { console.log(d); return d.bounds.x })
                  .attr('y', function (d) { return d.bounds.y })
                  .attr('width', function (d) { return d.bounds.width() })
                  .attr('height', function(d) { return d.bounds.height() });

              node.attr("cx", function (d) { return d.x; })
                  .attr("cy", function (d) { return d.y; });
          });
          // turn on overlap avoidance after first convergence
          d3cola.on("end", function () {
              console.log('end')
              // d3cola.constraints([])
              // d3cola.start()
              // d3cola.stop()
              //if (!d3cola.avoidOverlaps()) {
              //    graph.nodes.forEach(function (v) {
              //        v.width = v.height = 10;
              //    });
              //    d3cola.avoidOverlaps(true);
              //    d3cola.start();
              //}*/
          });
      });

