module.exports = function(grunt) {
  grunt.initConfig({
    includes: {
      main: {
        src: ['sense-search.js'],
        dest: 'build/',
        cwd: 'src/js'
      },
      picasso: {
        src: ['sense-search-picasso.js'],
        dest: 'build/',
        cwd: 'src/picasso'
      },
      enigmaSchema: {
        src: ['enigma-schema.js'],
        dest: 'examples/',
        cwd: 'src/enigma'
      }
    },
    watch: {
      styles: {
        files: ['src/**/*.js','src/less/**/*.less'], // which files to watch
        tasks: ['includes','uglify','less', 'copy'],
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
        beautify : false,
        mangle   : true,
        compress : true
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
            'build/sense-search-picasso.min.js': ['build/sense-search-picasso.js']
          },
          {
            'examples/sense-search-picasso.min.js': ['build/sense-search-picasso.js']
          },
          {
            'examples/enigma-schema.min.js': ['examples/enigma-schema.js']
          }
        ]
      }
    },
    express: {
			prod: {
				options: {
          port: 4000,
					script: "index.js"
				}
			}
		},
    copy: {
      main: {
        files: [
          { src: ['node_modules/enigma.js/enigma.min.js'], dest: 'examples/enigma.min.js'},
          { src: ['node_modules/picasso.js/dist/picasso.min.js'], dest: 'examples/picasso.min.js'},
          { src: ['node_modules/picasso-plugin-q/dist/picasso-q.min.js'], dest: 'examples/picasso-q.min.js'},
          { src: ['node_modules/picasso-plugin-hammer/dist/picasso-hammer.min.js'], dest: 'examples/picasso-hammer.min.js'},
          { src: ['node_modules/bootstrap/dist/css/bootstrap.min.css'], dest: 'examples/bootstrap.min.css'},
					{ src: ['build/sense-search.js'], dest: 'examples/sense-search.js'},
					{ src: ['build/sense-search-picasso.js'], dest: 'examples/sense-search-picasso.js'}
        ],
      }
    }
  });
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-includes');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-express-server');
  grunt.registerTask('default', ['copy','includes','uglify','less','express','watch']);
};
