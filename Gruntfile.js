module.exports = function(grunt) {
  grunt.initConfig({
    includes: {
      files: {
          src: ['sense-search.js'],
          dest: 'build/',
          cwd: 'src/js'
      }
    },
    watch: {
      styles: {
        files: ['src/**/*.js','src/less/**/*.less'], // which files to watch
        tasks: ['includes','uglify','less'],
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
        files: [
          {
            "build/sense-search.css": "src/less/main.less" // destination file and source file
          },
          {
            "/Users/nwr/2016/Development/Node/nlp-testing/public/sense-search.css": "src/less/main.less" // destination file and source file
          }
        ]
      },
      production: {
        options: {
          compress: true,
          yuicompress: true,
          optimization: 2
        },
        files: [
          {
            "build/sense-search.min.css": "src/less/main.less" // destination file and source file
          },
          {
            "examples/sense-search.min.css": "src/less/main.less" // destination file and source file
          }
        ]
      }
    },
    uglify:{
      options : {
        beautify : true,
        mangle   : false,
        compress : false
      },
      build: {
        files: [
          {
            'build/sense-search.min.js': ['build/sense-search.js']
          },
          {
            'examples/sense-search.min.js': ['build/sense-search.js']
          },
          {
            'build/nlp_compromise.min.js': ['node_modules/nlp_compromise/builds/nlp_compromise.js']
          },
          {
            'examples/nlp_compromise.min.js': ['node_modules/nlp_compromise/builds/nlp_compromise.js']
          },
          {
            '/Users/nwr/2016/Development/Node/nlp-testing/public/nlp_compromise.min.js': ['node_modules/nlp_compromise/builds/nlp_compromise.js']
          },
          {
            '/Users/nwr/2016/Development/Node/nlp-testing/public/sense-search.min.js': ['build/sense-search.js']
          }

        ]
      }
    }
  });
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-includes');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.registerTask('default', ['includes','uglify','less','watch']);
};
