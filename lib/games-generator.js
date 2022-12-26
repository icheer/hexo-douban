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
    var items = $('.game-list .common-item');
    var list = [];
    var next = $('span.next a').attr('href') || '';
    if (next.startsWith("?")) {
        next = url.substring(0, url.lastIndexOf('?')) + next;
    }
    items.each(function (idx, el) {
        const $el = cheerio.load(this);
        var title = $el('div.title a').text() || '';
        var alt = $el('div.title a').attr('href') || '';
        var image = $el('div.pic a img').attr('src') || '';
        var tags = $el('div.rating-info span.tags').text() || '';
        tags = tags ? tags.substring(3) : '';
        var date = $el('div.rating-info span.date').text() || '';
        var recommend = $el('div.rating-info span[class*=allstar]').attr('class') || '';
        recommend = renderStar(recommend.substring(19, 1));
        var comment = $el('div.content div:not([class])').text() || '';
        var info = $el('div.desc').text() || '';
        info = info.replace(/(^\s*)|(\s*$)/g, '');

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

    if (!config.douban || !config.douban.game) {//当没有输入game信息时，不进行数据渲染。
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

    var rawUrl = 'https://www.douban.com/people/' + config.douban.user + '/games';
    var playedUrl = rawUrl + '?action=collect';
    var playingUrl = rawUrl + '?action=do';
    var wishUrl = rawUrl + '?action=wish';

    var wish = [];
    var played = [];
    var playing = [];
    for (var nextWish = wishUrl; nextWish;) {
        var resWish = await resolv(nextWish, timeout);
        nextWish = resWish.next;
        wish = wish.concat(resWish.list);
        await sleep(300);
    }
    console.log(`想玩: ${wish.length}`);

    for (var nextPlaying = playingUrl; nextPlaying;) {
        var resPlaying = await resolv(nextPlaying, timeout);
        nextPlaying = resPlaying.next;
        playing = playing.concat(resPlaying.list);
        await sleep(300);
    }
    console.log(`在玩: ${playing.length}`);

    for (var nextPlayed = playedUrl; nextPlayed;) {
        var resPlayed = await resolv(nextPlayed, timeout);
        nextPlayed = resPlayed.next;
        played = played.concat(resPlayed.list);
        await sleep(300);
    }
    console.log(`玩过: ${played.length}`);

    var endTime = new Date().getTime();

    var offlinePrompt = offline ? ", because you are offline or your network is bad" : "";

    var sum = wish.length + playing.length + played.length;
    log.info(`${sum} games have been loaded in ` + (endTime - startTime) + " ms" + offlinePrompt);
    if (!sum) return;

    var __ = i18n.__(config.language);

    var contents = ejs.renderFile(path.join(__dirname, 'templates/game.ejs'), {
        'quote': config.douban.game.quote,
        'wish': wish,
        'played': played,
        'playing': playing,
        '__': __,
        'root': root
    }, function (err, result) {
        if (err) console.log(err);
        return result;
    });

    return {
        path: 'games/index.html',
        data: {
            title: config.douban.game.title,
            content: contents,
            slug: 'games'
        },
        layout: ['page', 'post']
    };
};
