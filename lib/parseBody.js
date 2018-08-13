const raw = require('raw-body');
const xml2js = require('xml2js/lib/parser');

const parseXml = function(str) {
  return new Promise((resolve, reject) => {
    const parser = new xml2js.Parser(/*{
      xmlns: true,
      tagNameProcessors: [stripPrefix]
    }*/);
    parser.parseString(str, (err, res) => {
      if (err) { return reject(err); }
      return resolve(res);
    });
  });
};

module.exports = async function(ctx) {
  ctx.request.body = await raw(ctx.req, {
    encoding: true,
    limit: '1mb' // practical
  });

  if (ctx.request.type === 'application/xml') {
    ctx.request.xml = await parseXml(ctx.request.body);
  } else if (ctx.request.type === 'text/calendar') {

  }
};
