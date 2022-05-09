/*
* Gulp Builder (Dist)
* @version: 1.0.0 (Fri, 08 May 2020)
* @author: HtmlStream
* @license: Htmlstream (https://htmlstream.com/licenses)
* Copyright 2020 Htmlstream
*/
const del                             = require('del');

const {config, context, pathLevel, shieldingVariables, shieldingFunctions, additionNames, gulpLighten, gulpDarken, gulpRGBA}   = require('./core');
const paths                                                             = require('./paths');
const {svgCompiler}                                                     = require('./svg-compiler')

const gulp                                                              = require('gulp');
const fileinclude                                                       = require('gulp-file-include');
const replace                                                           = require('gulp-replace');
const deleteLines                                                       = require('gulp-delete-lines');
const concat                                                            = require('gulp-concat');
const uglify                                                            = require('gulp-uglify-es').default;
const sass                                                              = require('gulp-sass')
const cleanCSS                                                          = require('gulp-clean-css');
const rename                                                            = require('gulp-rename');
const autoprefixer                                                      = require('gulp-autoprefixer');
var rtlcss                                                              = require('gulp-rtlcss');
var prettify                                                            = require('gulp-prettify');

let node = [],
  skipedFiles = [];

function fileInclude() {
  return gulp
    .src([
      paths.src.html.files,
      '!' + paths.src.assets.files,
      '!' + paths.src.tmp.files,
      '!' + paths.src.partials.files
    ])
    .pipe(replace(/@@autopath/g, function (match) {
      return pathLevel(this.file)
    }))
    .pipe(fileinclude({
      prefix: '@@',
      basepath: '@file',
      indent: true,
      context: context
    }))
    .pipe(replace(/@@autopath/g, function (match) {
      return pathLevel(this.file)
    }))
    .pipe(replace(new RegExp('(\\.+\\/)+' + additionNames.js + '\/.*\\.js', 'g'), function (match) {
      path = match.replace(/(\.+\/)+/, '')

      if (config.skipFilesFromBundle.dist.indexOf(path) < 0) {
        return match + " " + config.deleteLine
      } else {
        skipedFiles.push(paths.src.base.dir + "/*" + path)
      }

      return match
    }))
    .pipe(replace(new RegExp('(\\.+\\/)+' + additionNames.css + '\/.*\\.css', 'g'), function (match) {
      return match.replace('.css', '.min.css')
    }))
    .pipe(replace(new RegExp('(\\.+\\/)+' + "node_modules" + '\/.*\\.*', 'g'), function (match, p1) {
      path = match.replace(/(\.+\/)+/, '')
      splitedPath = path.split('/')

      node.push('./' + splitedPath[0] + '/*' + splitedPath[1] + '/**')

      return match.replace('node_modules', paths.dist.vendor.dir.replace(paths.dist.base.dir + '/', ''))
    }))
    .pipe(replace(/gulpLighten\[(.*?)\]/g, function (math, p1) {
      return gulpLighten(p1)
    }))
    .pipe(replace(/gulpDarken\[(.*?)\]/g, function (math, p1) {
      return gulpDarken(p1)
    }))
    .pipe(replace(/gulpRGBA\[(.*?)\]/g, function (math, p1) {
      return gulpRGBA(p1)
    }))
    .pipe(deleteLines({
      'filters': [
        new RegExp(config.deleteLine, 'i')
      ]
    }))
    .pipe(deleteLines({
      'filters': [
        new RegExp(config["deleteLine:dist"], 'i')
      ]
    }))
    .pipe(deleteLines({
      'filters': [
        /<!-- bundlecss:vendor \[(.*?)\](.*)-->/i
      ]
    }))
    .pipe(deleteLines({
      'filters': [
        /<!-- bundlecss:theme \[(.*?)\](.*)-->/i
      ]
    }))
    .pipe(deleteLines({
      'filters': [
        /<!-- bundlejs:vendor \[(.*?)\](.*)-->/i
      ]
    }))
    .pipe(replace(new RegExp(config["deleteLine:build"], 'g'), ''))
    .pipe(replace(/<!-- bundlejs:theme \[(.*?)\](.*)-->/g, function (math, p1, p2) {
      return `<script src="${p1}/${paths.dist.build.js}/${config.fileNames.dist.js}${p2.trim()}"></script>`;
    }))
    .pipe(replace(/(\[\@\@\]).*?/g, function (match, p1) {
      return shieldingVariables(match, p1);
    }))
    .pipe(replace(/(\[@\@F\]).*?/g, function (match, p1) {
      return shieldingFunctions(match, p1);
    }))
    .pipe(replace(/\<\/head\>/g, function (math, p1) {
      const visablilityStyles = `<style>[data-hs-theme-appearance]:not([data-hs-theme-appearance='${config.themeAppearance.layoutSkin}']){display:none;}</style>`
      return `
        <script>
            window.hs_config = ${JSON.stringify(config)}
            window.hs_config.gulpRGBA = ${gulpRGBA}
            window.hs_config.gulpDarken = ${gulpDarken}
            window.hs_config.gulpLighten = ${gulpLighten}
            </script>${!config.layoutBuilder.extend.switcherSupport ? visablilityStyles : ''}                
      </head>`
    }))
    .pipe(replace(/\<\!\-\- ONLY DEV \-\-\>(.|\n)*?\<\!\-\- END ONLY DEV \-\-\>\s+/g, ''))
    .pipe(replace(/\/\/ ONLY DEV(.|\n)*?\/\/ END ONLY DEV\s+/g, ''))
    .pipe(prettify({
      indent_inner_html: false,
      unformatted: ['pre', 'code', 'script'],
      preserve_newlines: true
    }))
    .pipe(gulp.dest(paths.dist.base.dir))
};

function minCSS() {
  return gulp
    .src(paths.src.css.files)
    .pipe(cleanCSS({compatibility: 'ie11'}))
    .pipe(rename({suffix: '.min'}))
    .pipe(gulp.dest(paths.dist.css.dir))
}

function rtlCSS() {
  return gulp
    .src(paths.src.css.files)
    .pipe(rtlcss())
    .pipe(cleanCSS({compatibility: 'ie11'}))
    .pipe(rename({ suffix: '-rtl' }))
    .pipe(gulp.dest(paths.dist.css.dir))
}

function minJS() {
  let bundle = [paths.src.js.dir + '/hs.core.js', paths.src.js.files];

  config.skipFilesFromBundle.dist.forEach(file => {
    bundle.push("!" + paths.src.base.dir + "/*" + file)
  })

  if (bundle.length) {
    return gulp
      .src(bundle)
      .pipe(concat(config.fileNames.dist.js))
      .pipe(uglify())
      .pipe(gulp.dest(paths.dist.js.dir));
  } else {
    return new Promise(function (resolve, reject) {
      resolve();
    });
  }
}

function copy() {
  return gulp
    .src([
      paths.src.assets.dir + '/**',
      '!' + paths.src.scss.dir + '/**',
      '!' + paths.src.svg.dir + '/**',
      '!' + paths.src.css.dir + '/**',
      '!' + paths.src.js.dir + '/**',
    ])
    .pipe(gulp.dest(paths.dist.assets.dir))
}

function copyNode() {
  node = new Set(node)

  if ([...node].length) {
    return gulp
      .src([...node])
      .pipe(gulp.dest(paths.dist.vendor.dir));
  } else {
    return new Promise(function (resolve, reject) {
      resolve();
    });
  }
}

function copySkipedFiles() {
  skipedFiles = new Set(skipedFiles)

  if ([...skipedFiles].length) {
    return gulp
      .src([...skipedFiles])
      .pipe(gulp.dest(paths.dist.base.dir));
  } else {
    return new Promise(function (resolve, reject) {
      resolve();
    });
  }
}

function copyDependencies() {
  for (var k in config.copyDependencies.dist) {
    path = k;

    if (k.search('node_modules') !== 0) {
      path = './src' + '/' + k
    }

    gulp
      .src(path)
      .pipe(gulp.dest(paths.dist.base.dir + '/' + config.copyDependencies.dist[k]))
  }

  return new Promise(function (resolve, reject) {
    resolve();
  });
}

function copyFavicon() {
  return gulp
    .src(paths.src.base.dir + "/favicon.ico")
    .pipe(gulp.dest(paths.dist.base.dir));
}

function clean() {
  return del(paths.dist.base.dir, {force: true});
}

gulp.task('dist', gulp.series(clean, fileInclude, minCSS, rtlCSS, minJS, svgCompiler, copy, copyNode, copySkipedFiles, copyDependencies, copyFavicon));
