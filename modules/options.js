const path = require('path');

let _options = {};

/*
** compose options from arguments
**
** example:
** --dev -testnet -reindex -rpcuser=user -rpcpassword=pass
** strips --dev out of argv (double dash is not a particld argument) and returns
** {
**   dev: true,
**   testnet: true,
**   reindex: true,
**   rpcuser: user,
**   rpcpassword: pass
** }
*/

function isVerboseLevel(arg) {
  let level = 0;
  let notVerbose = false;
  [...arg].map(char => char === 'v' ? level++ : notVerbose = true);
  return notVerbose ? false : level;
}

exports.parse = function() {

  let options = {};
  if (process.argv[0].match(/[Ee]lectron/)) {
    process.argv = process.argv.splice(2); /* striping 'electron .' from argv */
  } else {
    process.argv = process.argv.splice(1); /* striping /path/to/particl from argv */
  }

  // make a copy of process.argv, because we'll be changing it
  // which messes with the map operator
  const args = process.argv.slice(0);

  args.map((arg, index) => {
    let nDashes = 0;
    for (let i = 0; i < arg.length; i++) {
      if (arg.charAt(i) == '-') {
          nDashes++;
      } else {
          break;
      }
    }
    const argIndex = process.argv.indexOf(arg);
    arg = arg.substr(nDashes);

    if (nDashes === 2) { /* double-dash: desktop-only argument */
      // delete param, so it doesn't get passed to particl-core
      process.argv.splice(argIndex, 1);
      let verboseLevel = isVerboseLevel(arg);
      if (verboseLevel) {
        options['verbose'] = verboseLevel;
        return ;
      }
      if (arg.includes('=')) {
        arg = arg.split('=');
        if (arg[0] == 'customdaemon') {
            options[arg[0]] = arg[1];
            return ;
        }
      }
    } else if (nDashes === 1) { /* single-dash: core argument */

      // MacOS / OSX likes to add a Process Serial Numbers
      // filter it out before being passed to particl-core.
      if (arg.startsWith("psn_")) {
        process.argv.splice(argIndex, 1);
      }


      if (arg.includes('=')) {
        arg = arg.split('=');
        options[arg[0]] = arg[1];
        return ;
      }
    }
    options[arg] = true;
  });

  options.port = options.rpcport
    ? options.rpcport // custom rpc port
    : options.testnet
      ? 51935  // default testnet port
      : 51735; // default mainnet port
  console.log('port=' + options.port);
  _options = options;
  return options;
}

exports.get = function() {
  if (!_options.port) {
    exports.parse();
  }
  return _options;
}
