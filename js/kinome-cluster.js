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
            this.kinaseGrp = d3.select('svg#kinome g#kinase_grp')
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
    var radiusOptionModel = new OptionModel({ name: 'radius', value: 40 });
    var radiusOptionView = new OptionView(radiusOptionModel, $('input#radius'));

    // opacity
    var opacityOptionModel = new OptionModel({ name: 'opacity', value: 0.8 });
    var opacityOptionView = new OptionView(opacityOptionModel, $('input#opac'));

    // clusters
    var clusters;   // list of clusters
    var clustersOptionModel = new OptionModel({ name: 'clusters', value: 2 });
    var clustersOptionView = new OptionView(clustersOptionModel, $('input#K'));
    clustersOptionModel.on('change', function() {
        calculateClusters();
        this.trigger('clustered');
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
            this.g = d3.select('#kinome')
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
                .style('fill', function(d) {
                    var intensity = d.data.get('intensity');
                    return colors(getCluster(intensity));
                });
            this.el.append('text')
                .attr('transform', function(d) {
                    return 'translate(' + self.arc.centroid(d) + ')';
                })
                .style('text-anchor', function(d, i) {
                    if (i < self.observations.length / 2) {
                        return 'start';
                    }
                    return 'end';
                })
                .text(function(d) {
                    return d.data.get('ptm');
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

    dataset.on('reset', function(d) {
        calculateClusters();
        var gidSet = _.uniq(this.pluck('geneid'));
        var data;
        for (var i = 0; i < gidSet.length; i++) {
            data = new Dataset(this.where({ geneid: gidSet[i] }));
            plots.push(new Plot(data));
        }
    });

    /* Demo */
    $('#demo').on('click', function() {
        dataset.fetch({ reset: true });
    });


})(jQuery);
