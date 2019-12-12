export function catmull_rom(data0: {x: number, y: number}[], k: number) {
  // https://codepen.io/osublake/pen/BowJed
  const data: number[] = []
  data0.forEach(p => {
    data.push(p.x)
    data.push(p.y)
  })

  if (k == null) k = 1;

  var size = data.length;
  var last = size - 4;

  var path = "M" + [data[0], data[1]];

  for (var i = 0; i < size - 2; i +=2) {

    var x0 = i ? data[i - 2] : data[0];
    var y0 = i ? data[i - 1] : data[1];

    var x1 = data[i + 0];
    var y1 = data[i + 1];

    var x2 = data[i + 2];
    var y2 = data[i + 3];

    var x3 = i !== last ? data[i + 4] : x2;
    var y3 = i !== last ? data[i + 5] : y2;

    var cp1x = x1 + (x2 - x0) / 6 * k;
    var cp1y = y1 + (y2 - y0) / 6 * k;

    var cp2x = x2 - (x3 - x1) / 6 * k;
    var cp2y = y2 - (y3 - y1) / 6 * k;

    path += "C" + [cp1x, cp1y, cp2x, cp2y, x2, y2];
  }

  return path;
}
