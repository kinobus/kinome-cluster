/* kinome-cluster.js
 * Copyright 2012 (c) Joseph Lee & Nick Robin
 * This software may be distributed under the MIT License
 * See file LICENSE for details
 *
 * http://code.google.com/p/kinome-overlay
 */


(function ($) {
    var colors = d3.scale.category10();

    /* Static kinase definitions */

    var KinaseModel = Backbone.Model.extend({});
    var KinaseCollection = Backbone.Collection.extend({
        model: KinaseModel,
        url: 'data/kotable.json'
    });
    var KinaseView = Backbone.View.extend({
        initialize: function() {
            this.listenTo(this.collection, 'reset', this.render);
        },
        render: function() {
            this.kinaseGrp = d3.select('svg#kinome g#static')
                .selectAll('circle')
                .data(this.collection.models)
                .enter()
                .append('svg:circle')
                .attr('cx', function(m) { return m.get('x'); })
                .attr('cy', function(m) { return m.get('y'); })
                .style('fill', '#fff')
                .style('fill-opacity', 0.5)
                .style('stroke', '#000')
                .style('stroke-width', 0.5)
                .style('stroke-opacity', 0.5)
                .attr('r', 4);
        }
    });

    // Instantiation
    var kinases = new KinaseCollection();
    var kinaseView = new KinaseView({ collection: kinases });
    kinases.fetch({ reset: true });



    /* Options */

    var OptionModel = Backbone.Model.extend({});
    var OptionView = Backbone.View.extend({
        initialize: function(option, elem) {
            this.model = option;
            this.$el = elem;
        },
        events: {
            'change': 'update'
        },
        update: function() {
            console.log('update');
            this.model.set('value', parseFloat(this.$el.val()));
        }
    });

    // radius
    var radiusOptionModel = new OptionModel({ name: 'radius', value: 20 });
    var radiusOptionView = new OptionView(radiusOptionModel, $('input#radius'));

    // opacity
    var opacityOptionModel = new OptionModel({ name: 'opacity', value: 0.6 });
    var opacityOptionView = new OptionView(opacityOptionModel, $('input#opac'));

    // clusters
    var clusters;   // list of clusters
    var clustersOptionModel = new OptionModel({ name: 'clusters', value: 2 });
    var clustersOptionView = new OptionView(clustersOptionModel, $('input#K'));
    clustersOptionModel.on('change', function() {
        calculateClusters();
        this.trigger('clustered');
    });

    var ClusterTable = Backbone.View.extend({
        initialize: function() {
            this.$el = $('table#clusterTable');
            this.tbody = $('tbody', this.$el);
            this.model = clustersOptionModel;
            this.dataset = dataset;
            this.listenTo(this.model, 'clustered', this.render);
            this.listenTo(this.dataset, 'clustered', this.render);
        },
        render: function() {
            var row, color, mean;
            this.tbody.empty();
            if (typeof clusters !== 'undefined') {
                for (var i = 0; i < this.model.get('value'); i++) {
                    color = $('<div></div>')
                        .css('width', '40px')
                        .css('height', '20px')
                        .css('display', 'inline-block')
                        .css('background-color', colors(i));
                    mean = $('<div></div>').attr('id', 'mean' + (i + 1));
                    row = $('<tr></td>');
                    row.append($('<td>' + (i + 1) + '</td>'));
                    row.append($('<td></td>').append(color));
                    row.append($('<td></td>').append(mean));
                    this.tbody.append(row);
                    $('#mean' + (i + 1)).sparkline(getMeanSeries(i), {
                        type: 'line',
                        width: '80px',
                        fillColor: '#fff'
                    });
                }
                this.$el.css('visibility', 'visible');
            }
        }
    });


    /* Experimental Values */

    // uploaded data row
    var Observation = Backbone.Model.extend({});
    var Dataset = Backbone.Collection.extend({
        model: Observation,
        url: 'data/clusterDemo-ptm.json',
        parse: function(data) {
            return data.map(function(d) {
                return {
                    geneid: d[0],
                    ptm: d[1],
                    intensity: d.slice(2)
                };
            });
        }
    });

    var dataset = new Dataset();
    clusterTable = new ClusterTable();

    var Plot = Backbone.View.extend({
        initialize: function(observations) {
            this.observations = observations;
            this.kinase = kinases.findWhere({
                geneid: this.observations.at(0).get('geneid')
            });
            this.radius = radiusOptionModel;
            this.opacity = opacityOptionModel;
            this.cluster = clustersOptionModel;

            this.pie = d3.layout.pie()
                .sort(null)
                .value(function(d) { return 1; });
            this.g = d3.select('#kinome #plot')
                .append('svg:g')
                .attr('transform', 'translate(' + this.kinase.get('x') + ',' +
                      this.kinase.get('y') + ')');

            this.listenTo(this.radius, 'change', this.render);
            this.listenTo(this.opacity, 'change', this.render);
            this.listenTo(this.cluster, 'clustered', this.render);

            this.render();
        },
        render: function() {
            var self = this;
            if (this.hasOwnProperty('el')) {
                this.el.remove();
            }
            if (this.hasOwnProperty('labelGrp')) {
                this.labelGrp.remove();
            }
            this.arc = d3.svg.arc()
                .outerRadius(this.radius.get('value'))
                .innerRadius(0);
            this.el = this.g.selectAll('.obs')
                .data(this.pie(this.observations.models))
                .enter()
                .append('g')
                .attr('class', 'obs');
            this.el.append('path')
                .attr('d', this.arc)
                .attr('fill-opacity', this.opacity.get('value'))
                .style('stroke', '#fff')
                .style('stroke-width', 1.5)
                .style('fill', function(d) {
                    var intensity = d.data.get('intensity');
                    return colors(getCluster(intensity));
                });
            this.labelGrp = d3.select('#kinome #label')
                .append('svg:g')
                .attr('transform', 'translate(' +
                      this.kinase.get('x') + ',' +
                      this.kinase.get('y') + ')');
            this.label = this.labelGrp.selectAll('.lbl')
                .data(self.pie(this.observations.models))
                .enter()
                .append('g')
                .attr('class', 'lbl');
            this.label.append('text')
                .attr('transform', function(d) {
                    return 'translate(' + self.arc.centroid(d) + ')';
                    //return 'translate(0, 0)';
                })
                .style('text-anchor', function(d, i) {
                    if (i < self.observations.length / 2) {
                        return 'start';
                    }
                    return 'end';
                })
                .attr('id', function(d) { return d.data.get('ptm'); })
                .style('font-family', 'sans-serif')
                .text(function(d) {
                    if (self.observations.length > 1) {
                        return d.data.get('ptm');
                    }
                    return self.kinase.get('name');
                });
        }
    });

    var plots = [];


    // calculate clusters
    var calculateClusters = function() {
        clusters = clusterfck.kmeans(dataset.pluck('intensity'),
                                     clustersOptionModel.get('value'));
    };
    
    // get cluster number
    var getCluster = function (intensity) {
        var cluster, row, match;
        for (var i = 0; i < clusters.length; i++) {
            cluster = clusters[i];
            for (var j = 0; j < cluster.length; j++) {
                row = cluster[j];
                match = true;
                for (var k = 0; k < row.length && match === true; k++) {
                    if (intensity[k] != row[k]) {
                        match = false;
                    }
                }
                if (match === true) {
                    return i;
                }
            }
        }
        return undefined;
    };

    var getMeanSeries = function (clusterNum) {
        var cluster = clusters[clusterNum];
        var row, mean = [], sums = [];

        for (var i = 0; i < cluster[0].length; i++) {
            sums.push(0);
        }

        for (var i = 0; i < cluster.length; i++) {
            row = cluster[i];
            for (var j = 0; j < row.length; j++) {
                sums[j] += row[j];
            }
        }

        return sums.map(function(d) { return d / cluster.length; });
    };

    dataset.on('reset', function(d) {
        calculateClusters();
        this.trigger('clustered');
        var gidSet = _.uniq(this.pluck('geneid'));
        var data;
        for (var i = 0; i < gidSet.length; i++) {
            data = new Dataset(this.where({ geneid: gidSet[i] }));
            plots.push(new Plot(data));
        }
    });


    var FileUpload = Backbone.View.extend({
        initialize: function() {
            this.$el = $('#csv_file');
            this.demo = $('#demo');
            this.demo.on('click', function() {
                dataset.fetch({ reset: true });
            });
        },
        events: {
            change: 'upload'
        },
        upload: function(data) {
            var self = this;
            var files = this.$el[0].files;
            this.data = [];
            this.reader = new FileReader();
            this.reader.onloadend = function(e) {
                self.parseFile();
            };
            this.reader.readAsText(files[0]);
        },
        parseFile: function() {
            var raw = String(this.reader.result);
            raw = raw.replace(/\r/g, '');
            var rows = d3.csv.parseRows(raw);
            this.data = this.data.concat(rows.map(function(r) {
                var newRow = [];
                for (var i = 0; i < r.length; i++) {
                    if (i !== 1) {
                        newRow.push(Number(r[i]));
                    }
                    else {
                        newRow.push(r[i]);
                    }
                }
                return newRow;
            }));
            dataset.reset(dataset.parse(this.data));
        }
    });
    var fileUpload = new FileUpload();

    var kinomeBG;

    // request background kinome
    $.ajax({
        url: 'img/kinome.svg',
        dataType: 'text',
        success: function(svgText) {
            console.log('background svg loaded');
            kinomeBG = svgText;
            $('button#download').attr('disabled', false);
        },
        error: function(e) {
            console.log('error retreiving kinome.svg');
        }
    });

    /* SVG download event
     * using FileSaver.js */
    $('#download').click(function() {
        var dlButton = $(this);
        dlButton.attr('disabled', 'disabled');
        var bg_grp = /<[gG][^>]*>(.|[\r\n])*<\/[gG]>/.exec(kinomeBG)[0];
        var overlay = $('#kinomeDiv').html();
        var dl_svg = overlay.replace('<g id="replace"></g>',
                                     bg_grp);
        var svgBlob = new Blob([dl_svg], {
            type: 'image/svg+xml;'
        });
        saveAs(svgBlob, 'kinome.svg');
        dlButton.attr('disabled', false);
    });

})(jQuery);
