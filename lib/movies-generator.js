'use strict';

var request = require('request-promise');
var ejs = require('ejs');
var cheerio = require('cheerio');
var path = require('path');
var { renderStar, i18n, sleep } = require('./util');
var offline = false;

var log = require('hexo-log')({
    debug: false,
    silent: false
});

async function resolv(url, timeout) {
    var response = '';
    try {
        response = await request(url, {
            timeout: timeout,
            dataType: 'xml',
            headers: {
                'Referer': url,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36'
            }
        });
    } catch (err) {
        offline = true;
    }

    if (offline) {
        return {
            list: [],
            next: ""
        };
    }

    var $ = cheerio.load(response);
    var items = $('.grid-view .item');
    var list = [];
    var next = $('span.next a').attr('href') || '';
    if (next.startsWith("/")) {
        next = "https://movie.douban.com" + next;
    }

    items.each(function (idx, el) {
        const $el = cheerio.load(this);
        var title = $el('li.title a em').text() || '';
        var alt = $el('li.title a').attr('href') || '';
        var image = ($el('div.pic a img').attr('src') || '').replace('ipst', 'spst');
        var tags = $el('li span.tags').text() || '';
        tags = tags ? tags.substr(3) : '';
        var date = $el('li span.date').text() || '';
        date = date ? date : '';
        var recommend = $el('li span[class*="rating"]').attr('class') || '';
        recommend = renderStar(recommend.substr(6, 1));
        var comment = $el('li span.comment').text() || '';
        comment = comment ? comment : '';
        var info = $el('li.intro').text() || '';
        info = info ? info : '';

        list.push({
            title: title,
            alt: alt,
            image: image,
            tags: tags,
            date: date,
            recommend: recommend,
            comment: comment,
            info: info
        });
    });

    return {
        'list': list,
        'next': next
    };
}

module.exports = async function (locals) {
    var startTime = new Date().getTime();
    var config = this.config;
    if (!config.douban || !config.douban.movie) {//当没有输入movie信息时，不进行数据渲染。
        return;
    }

    var root = config.root;
    if (root.endsWith('/')) {
        root = root.slice(0, root.length - 1);
    }

    var timeout = 10000;
    if (config.douban.timeout) {
        timeout = config.douban.timeout;
    }

    var rawUrl = 'https://movie.douban.com/people/' + config.douban.user;
    var wishUrl = rawUrl + '/wish';
    var watchingUrl = rawUrl + '/do';
    var watchedUrl = rawUrl + '/collect';

    var wish = [];
    var watched = [];
    var watching = [];

    for (var nextWatching = watchingUrl; nextWatching;) {
        var resWatching = await resolv(nextWatching, timeout);
        nextWatching = resWatching.next;
        watching = watching.concat(resWatching.list);
        await sleep(300);
    }
    console.log(`在看: ${watching.length}`);

    for (var nextWish = wishUrl; nextWish;) {
        var resWish = await resolv(nextWish, timeout);
        nextWish = resWish.next;
        wish = wish.concat(resWish.list);
        await sleep(300);
    }
    console.log(`想看: ${wish.length}`);

    for (var nextWatched = watchedUrl; nextWatched;) {
        var resWatched = await resolv(nextWatched, timeout);
        nextWatched = resWatched.next;
        watched = watched.concat(resWatched.list);
        await sleep(300);
    }
    console.log(`看过: ${watched.length}`);

    var endTime = new Date().getTime();

    var offlinePrompt = offline ? ", because you are offline or your network is bad" : "";

    var sum = wish.length + watching.length + watched.length;
    log.info(`${sum} movies have been loaded in ` + (endTime - startTime) + " ms" + offlinePrompt);
    if (!sum) return;

    var __ = i18n.__(config.language);

    var contents = ejs.renderFile(path.join(__dirname, 'templates/movie.ejs'), {
        'quote': config.douban.movie.quote,
        'wish': wish,
        'watched': watched,
        'watching': watching,
        '__': __,
        'root': root
    },
        function (err, result) {
            if (err) console.log(err);
            return result;
        });

    return {
        path: 'movies/index.html',
        data: {
            title: config.douban.movie.title,
            content: contents,
            slug: 'movies'
        },
        layout: ['page', 'post']
    };
};
