# Ajax IM

## What is Ajax IM?

Ajax IM ("Ajax Instant Messenger") is an instant messenger for the web. It is
intended to be integrated with existing websites to provide a more interactive
community experience.

## Features

* Instant communication between connected users
* Robust backend server built on [Node.js](http://nodejs.org)
* Can be integrated with virtually any existing website
* Seamless authentication
* Works across an entire website, unobtrusively
* Automatic state management between page reloads
* User state and statuses
* and _much_ more!

## Installation

Install `Node.js`:
    wget http://nodejs.org/dist/v0.8.9/node-v0.8.9-linux-x86.tar.gz
    tar xzf node-v0.8.9-linux-x86.tar.gz
    cd node-v0.8.9
    ./configure
    make
    make install

Install Node Package Manager (`npm`):
    See instructions at http://github.com/isaacs/npm.

Install `Express.js`, `Connect` and `Cookie`:
    npm install express
    npm install connect
    npm install cookie

Compile the daemon add-on if you plan on letting the server daemonize itself:
    cd server/libs/daemon
    node-waf configure build
    cp build/default/daemon.node .
    rm -rf build

## Installation for Development

If you want to test Ajax IM as a standalone app for development, you will need
to install [`Jade`](http://github.com/visionmedia/jade) as well.

To install `Jade`:
    npm install jade

## Starting up the server

Starting the server in _development_ mode is as simple as:
    node server/app.js

To start the server in _production_ mode:
    EXPRESS_ENV=production node server/app.js

To start the server as a _daemon_ in _production_ mode:
    node server/app.js start production

## Testing it out

Once the server is up and running in _development_ mode, you can test it out
through the included development testing app. The below instructions are
assuming that you have left all default configuration options. If not, please
replace the host/port values with the correct ones.

To get started, first initialize a session cookie by going to:
    http://localhost:8000/dev/cookie

Then head over to the development page that will initialize the client:
    http://localhost:8000/dev/

That's it!

## More Information

* Follow [endtwist](http://twitter.com/endtwist) on twitter for updates
* [Google Group](http://groups.google.com/group/ajaxim) for discussion
* [GitHub Wiki](https://github.com/endtwist/AjaxIM/wiki) for guidance

## Node Compatibility

The `master` branch of Ajax IM is compatible with node --version:
    v0.8.9

## Contributing

Pull requests are being accepted! If you would like to contribute, simply fork
the project and make your changes.

### Style Guide

If you intend on contributing, please follow this style guide when submitting
patches or commits. Submissions that do not follow these guidelines will not
be accepted.

* Use 4 space indents (not tabs!)
* No trailing whitespace
* Blank line at the end of files
* Semi-colons at the ends of lines, where appropriate
* Keep lines to 80 characters or less
* Never bump the version

No whitespace between keys and values:
    {foo: 'bar'}
    // good
    
    {foo : 'bar'}
    // bad

Hash formatting:
    {foo: 'bar', baz: 'taz'}
    // good
    
    {
        foo: 'bar',
        baz: 'taz',
        moo: 'cow'
    }
    // good
    
    { foo: 'bar', baz: 'taz' }
    // bad
    
    {foo: 'bar',
     baz: 'taz',
     moo: 'cow'}
    // bad

Chained methods:
    str
        .strip
        .replace(...)
        .replace(...)
    // good
    
    str
    .strip
    .replace(...)
    .replace(...)
    // bad
    
    str.
        strip.
        replace(...).
        replace(...)
    // bad

Single quotes over double quotes, unless double quotes make sense:
    'hello'
    // good
    
    "what's up?"
    // good
    
    "hello"
    // bad

Ternary expressions are fine, but cannot be nested and must be formatted as:
    foo = (a ? b : c);
    // good
    
    foo = (something.hasAPropertyLikeThis == 'some other value'
               ? 'result one'
               : 'result two'
          );
    // good
    
    foo = something.hasAPropertyLikeThis === 'some other value' ?
              'result one' :
              'result two'
    // bad

Use braces for conditionals, unless conditionals are single statements:
    if(foo) {
        bar();
        baz();
    }
    // good
    
    if(foo) bar();
    else baz();
    // good
    
    if(foo)
        bar(),
        baz()
    // bad

Closures:
    function() {
    }
    // good
    
    function () {
    }
    // bad
    
    function()
    {
    }
    // bad

Methods:
    foo.bar = function() {
    }
    // good
    
    foo.bar = function (){
    }
    // bad
    
    foo.bar = function()
    {
    }
    // bad

## License

(The MIT License)

Copyright (c) 2012 [Daniel Howard] (http://www.svexpertise.com)  
Copyright (c) 2010 [Joshua Gross](http://www.unwieldy.net)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.