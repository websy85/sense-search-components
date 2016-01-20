module.exports = function(grunt) {
  grunt.initConfig({
    includes: {
      files:{
        src: ['sense-search.js'],
        dest: 'build/',
        cwd: 'src/js'
      }
    },
    watch: {
      styles: {
        files: ['src/**/*.js'], // which files to watch
        tasks: ['includes','less','uglify'],
        options: {
          nospawn: true,
          livereload: true
        }
      }
    },
    less:{
      development: {
        options: {
          compress: false,
          yuicompress: false,
          optimization: 2
        },
        files: {
          "build/sense-search.css": "src/less/main.less" // destination file and source file
        }
      },
      production: {
        options: {
          compress: true,
          yuicompress: true,
          optimization: 2
        },
        files: {
          "build/sense-search.min.css": "src/less/main.less" // destination file and source file
        }
      }
    },
    uglify:{
      options : {
        beautify : false,
        mangle   : true
      },
      build: {
        files: {
          'build/sense-search.min.js': ['build/sense-search.js']
        }
      }
    }
  });
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-includes');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.registerTask('default', ['includes','uglify','less','watch']);
};
