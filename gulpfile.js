// Scipilot/Logline src build - Gulp file

// Define base folders
var src = 'src';
var dest = 'dist';

var gulp = require('gulp');
var concat = require('gulp-concat');
var rename = require('gulp-rename');
var uglify = require('gulp-uglify');
//var sass = require('gulp-ruby-sass');
//var debug = require('gulp-debug');
var mainBowerFiles = require('main-bower-files');		// Helps find the bower JS products to combine
var es = require('event-stream');

var paths = {
	scripts: [],//mainBowerFiles('**/*.js'), // in this project we're only including my stuff! (it's not a website build it's a component...)
	//images: 'client/img/**/*',
	//sass: src+'/scss/styles.scss', // don't use wildcard to prevent multi-compile of sass-imports in this folder (it's a include tree from single top-level file).
	//css: mainBowerFiles('**/*.css')
};
paths.scripts.push(src+'/js/*.js');

// JS build
gulp.task('scripts', function() {
	return gulp.src(paths.scripts)
		//		.pipe(debug({title: 'debugjs:'}))
		.pipe(concat('jquery.scipilot-logline.js'))
		.pipe(rename({suffix: '.min'}))
		.pipe(uglify()) 
		.pipe(gulp.dest(dest+'/js'))
		//.pipe(browserSync.stream())
		;
});

// hawtcher bee watcher
gulp.task('watch', function() {
	gulp.watch(src+'/js/*.js', ['scripts']);
	// gulp.watch(src+'/scss/*.scss', ['sass']);
	// gulp.watch(src+'/scss/*.sass', ['sass']);
	//	gulp.watch(src+'/images/**/*', ['images']);
});

// Go
gulp.task('default', ['scripts', 'watch']);
