# Ajax IM

Ajax IM ("Ajax Instant Messenger") is a browser-centric instant
messaging framework.


## What is Ajax IM?

It uses AJAX to create a real-time (or near real-time) IM environment that
can be used in conjunction with existing community and commercial software,
or simply as a stand-alone product.


## Installation

Install `Node.js` (known to work with v0.1.98+):
    wget http://nodejs.org/dist/node-v0.1.101.tar.gz
    tar xzf node-v0.1.101.tar.gz
    cd node-v0.1.101
    ./configure
    make
    make install

Install Node Package Manager (`npm`):
    See instructions at http://github.com/isaacs/npm.

Install `Connect`:
    npm install connect

Install `Express.js`:
    npm install express

## Installation for Development

If you will want to test Ajax IM standalone for development, you will want to
install [`Jade`](http://github.com/visionmedia/jade) as well.

To install `Jade`:
    npm install jade

## Starting up the server

Starting the server in _development_ mode is as simple as:
    node server/app.js

To start the server in _production_ mode:
    EXPRESS_ENV=production node server/app.js

## License

(The MIT License)

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