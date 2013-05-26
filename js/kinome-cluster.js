/* kinome-cluster.js
 * Copyright 2012 (c) Joseph Lee & Nick Robin
 * This software may be distributed under the MIT License
 * See file LICENSE for details
 *
 * http://code.google.com/p/kinome-overlay
 */


(function ($) {

    var render= {
        url: 'http://ruby.cat.pdx.edu:5050/render'
    };
        

    // initialize cluster table to be invisible until data loaded
    $("#clusterTable").css("visibility", "hidden");

    // radius slider
    $("input#radius").css("width", "100%")
        .on("change", function() {
            KVM.radius = $(this).attr("value");
            $("label#radius").text(KVM.radius);
            KVM.setRadii();
        });
    // cluster number, K slider
    $("input#K").css("width", "100%")
        .on("change", function() {
            KVM.K = $(this).attr("value");
            $("label#K").text(KVM.K);
            KVM.setClusters();
            KVM.setColors();
        });
    // opacity range slider
    $("input#opac").css("width", "100%")
        .on("change", function() {
            KVM.opac = $(this).attr("value");
            $("label#opac").text(KVM.opac);
            d3.selectAll(".data#pts").style("fill-opacity", function() {
                return KVM.opac;
            });
        });
    // Demo button
    $("a#demo").click(function() {
        $.getJSON("data/clusterDemo1.json", function(demoData) {
            KVM.clearData();
            KVM.applyData(demoData);
        });
    });

    /**
     * Kinome
     * ViewModel
     */
    var KinomeViewModel = function() {
        var self = this;
        self.width = 825;
        self.height = 975;

        // radius scaling values
        self.radius = 40;

        // set labels for scaling factors
        self.radiusLabel = $("label#radius").text(self.radius);

        // clustering k-value
        self.K = 2;
        self.kLabel = $("label#K").text(self.K);

        // mean of each centroid
        self.clusterMeans = [];

        // opacity
        self.opac = 0.8;

        // set opacity label
        self.opacLabel = $("label#opac").text(self.opac);

        // array of color hexes of each cluster
        self.colors = [];

        self.timecourses = 0;   // number of timecourses in experiment

        // svg elements
        self.svg = d3.select("#kinome");
        self.dataGrp = d3.select(".data#grp");


        // Synchronously get kinase coordinates
        self.kinases = [];
        $.ajax({
            async: false,
            dataType: "json",
            url: "kotable.json",
            success: function(data) {
                while(data.length > 0) {
                    var temp = data.pop();
                    temp.x /= 4;
                    temp.y /= 4;
                    temp.Intensity = [];
                    temp.fixed = true;
                    self.kinases.push(temp);
                }
            }
        });

        // plot static kinases endpoints
        self.kinaseGrp = d3.select("#kinase_grp").selectAll("circle")
            .data(self.kinases)
            .enter()
            .append("svg:circle")
            .attr("cx", function(d) { return d.x; })
            .attr("cy", function(d) { return d.y; })
            .attr("r", 4)
            .attr("class", "kinase")
            .attr("stroke", "black")
            .attr("stroke-width", 0.4)
            .attr("fill", "white")
            .attr("fill-opacity", 0.5)
            .attr("id", function(d) { return d.GeneID; });

        /* Upload file handle */
        self.userData = [];
        self.reader = new FileReader();

        // Event binding on View: input file-upload
        self.onFileUpload = $("#csv_file").change(function() {
            var upload_file = document.getElementById("csv_file").files;
            self.reader.readAsText(upload_file[0]);
            // for (i = 0; i < upload_file.length; i++) {
            //     self.reader.readAsText(upload_file[i]);
            // }
        });

        // Event triggered by finished file upload
        // called upon completion of reader.readAsText
        self.reader.onloadend = function(e) {

            // parse input rawData
            var rawData = String(self.reader.result);
            while (rawData.indexOf('\r') >= 0) {
                rawData = rawData.replace('\r', "");
            }
            //rawData = rawData.split("\n");
            var rows = rawData.split('\n');
            if (rows[rows.length - 1].length == 0) {
                rows.pop();     // remove empty last row
            }
            var table = [];
            var temp = '';
            for (z = 0; z < rows.length; z++) {
                temp = rows[z].split(',');
                for (y = 1; y < temp.length; y++) {
                    temp[y] = parseFloat(temp[y]);
                }
                table.push(temp);
            }
            self.applyData(table);
        };

        self.parseRawData = function(csvText) {
            csvText = csvText.replace(String.fromCharCode(13), "");
            var rows = csvText.split('\n');
            var data = [];
            if (rows[rows.length - 1].length == 0) {
                rows.pop();     // remove empty last row
            }
            for (i = 0; i < rows.length; i++) {
                data.push(rows[i].split(','));
            }
            return data;
        }


        // Return Kinase object by GeneID
        self.getKinaseById = function (geneid) {
            for (i = 0; i < self.kinases.length; i++) {
                if (self.kinases[i].GeneID = geneid) {
                    return self.kinases[i];
                }
            }
            return undefined;
        };

        // obtain approriate color for intensity
        self.getColor = function (clusterNum) {
            var colorSet = self.colors[clusterNum - 1];
            if (colorSet != undefined) {
                return colorSet.val();
            }
            else {
                return "#a0a0a0";
            }
        };

        // change all radii accordingly
        // use radius scaling events for data points
        self.setRadii = function() {
            d3.selectAll(".data#pts")
                .attr("r", self.radius);
            // make labels disappear when datapt radius is zero
            d3.selectAll(".data#label")
                //.attr("visibility", function(d) {
                //    return self.radius > 0 ? "visible"
                //        : "hidden";
                //});
                .attr("display", function(d) {
                    return self.radius > 0 ? "inline"
                        : "none";
                });
        };

        // change all colors accordingly
        // use color changing events for data points
        self.setColors = function() {

            // set all data node colors
            d3.selectAll(".data#pts")
                .style("fill", function(d) {
                    return self.getColor(d.Cluster);
                });

        };

        // purge all intensity data from kinases
        self.clearData = function () {
            self.userData = [];
            for (i = 0; i < self.kinases.length; i++) {
                self.kinases[i].Intensity = 0;
            }
            self.userData = [];
        };

        // assign random colors to the first 20 clusters
        self.defaultColor = function(i) {
            switch(i) {
                case 1: return "0000ff";
                case 2: return "00ff00";
                case 3: return "ff0000";
                case 4: return "ffff00";
                case 5: return "00ffff";
                case 6: return "85a350";
                case 7: return "ff00ff";
                case 8: return "ff99cc";
                case 9: return "ffcc99";
                case 10: return "99ccff";
                case 11: return "808080";
                case 12: return "00ccff";
                case 13: return "339966";
                case 14: return "33cccc";
                case 15: return "333333";
                case 16: return "aaaaaa";
                case 17: return "ff8888";
                case 18: return "88ff88";
                case 19: return "8888ff";
                case 20: return "8f29c3";
                default: return "0a0a0a";
                         break;
            }
        }

        // exporter
        $('#export').click(function() {
            $(this).attr('disabled', true);
            var serializer = new XMLSerializer();
            var kinome = document.getElementById('kinome');
            var svgText = serializer.serializeToString(kinome);
            // send plotted svg data to KinoRender server
            var data = {
                svg: svgText,
                app: 'kinome-cluster'
            };
            $.ajax({
                url: render.url,
                data: data,
                jsonp: 'jsonp',
                success: function(data) {
                    var img = '<img src="data:image/png;base64,' + data.png + '" />';
                    $('body').html(img);
                }
            });
        });


        // parse, plot user uploaded data
        // inputData should be sufficiently parsed
        // to an array of n-element arrays:
        // [ [ GeneID, intensity-value ], ... ]
        // where n is number of timecourses per sample
        self.applyData = function (inputData) {
            // obtain number of timecourses from first row
            self.timecourses = inputData[0].length - 1;
            // parse input data
            while (inputData.length > 0) {
                var temp = inputData.pop();
                var match = false;
                for (i = 0; i < self.kinases.length; i++) {
                    // search for GeneID match
                    if (self.kinases[i].GeneID == temp[0]) {
                        match = true;
                        temp.splice(0, 1);
                        self.kinases[i].Intensity = temp;
                        self.userData.push(self.kinases[i]);
                    }
                }
                if (match == false) {
                    console.log('Gene ID: "' + temp[0] + '" not found.');
                }
            }
            // $("input#K").attr("max", self.userData.length);
            // Cluster slider max now set to max number of data rows
            self.setClusters();
            self.setForce();    // run force layout
        };

        /* Use Clusterfck to separate intensities into clusters
         */
        self.setClusters = function() {
            self.clusters = [];
            self.colors = [];
            var intensities = [];
            // array of intensities
            for (i = 0; i < self.userData.length; i++) {
                intensities.push(self.userData[i].Intensity);
            }
            // first, let K have max of number of data - 1
            $("#K").attr("max", 20);
            self.clusters = clusterfck.kmeans(intensities, self.K);

            // assign clusters
            // find intensity array matching those in each cluster
            for (i = 0; i < self.userData.length; i++) {
                var temp = self.userData[i];
                var tempInt = temp.Intensity;
                // j is cluster number
                for (j = 0; j < self.K; j++) {
                    // which elem in cluster array
                    for (k = 0; k < self.clusters[j].length; k++) {
                        var match = true;
                        for (m = 0; m < self.timecourses && match == true; m++) {
                            if (tempInt[m] != self.clusters[j][k][m]) {
                                match = false;
                            }
                        }
                        if (match == true) {
                             temp.Cluster = j + 1;
                        }
                    }
                }
            }
            // show cluster table
            $("#clusterTable").css("visibility", "visible");
            // clear table body before adding rows
            $("#clusterTableBody").html("");
            // add row
            for (i = 1; i <= self.K; i++) {
                var row = '<tr><td>' + i + '</td><td><input id="color' + i + '" type="text" style="display: none"></td><td><div id="sparkline' + i + '"></div></td></tr>';
                $("#clusterTableBody").append(row);
                // set jquery colorpicker
                $("#color" + i).colorPicker({
                    pickerDefault: self.defaultColor(i),
                    onColorChange: function() {
                        self.setColors();
                    }
                });
                self.colors.push($("#color" + i));
            }

            // add sparklines
            self.getClusterMeans();
            for (i = 1; i <= self.K; i++) {
                $("#sparkline" + i).sparkline(self.clusterMeans[i - 1], {
                    type: 'line',
                    width: '80px',
                    fillColor: '#ffffff'
                });
            }
        }

        self.getClusterMeans = function() {
            self.clusterMeans = [];     // clear
            for (i = 0; i < self.K; i++) {
                var cluster = self.clusters[i];
                var sum = [];   // running count of sum within cluster
                for (j = 0; j < cluster[0].length; j++) {
                    sum.push(cluster[0][j]);
                }
                for (j = 1; j < cluster.length; j++) {
                    for (k = 0; k < cluster[j].length; k++) {
                        sum[k] += cluster[j][k];
                    }
                }
                // divide sum by n to find mean
                var mean = [];
                for (j = 0; j < sum.length; j++) {
                    mean.push(sum[j] / cluster.length);
                }
                self.clusterMeans.push(mean);
            }
        }

        /**
         * LABELS USING FORCES
         * Plot collision detecting labels using d3 force layout
         */

        self.setForce = function() {
            // establish data
            self.label = {};
            self.label.nodes = [];
            self.label.links = [];
            // shallow copies of userData
            for (i = 0; i < self.userData.length; i++) {
                self.label.nodes.push(self.userData[i]);
            }
            // label info
            for (i = 0; i < self.userData.length; i++) {
                var temp = self.userData[i];
                self.label.nodes.push({
                    "GeneID": temp.GeneID,
                    "KinaseName": temp.KinaseName,
                    "Intensity": temp.Intensity,
                    "fixed": false,
                    "x": temp.x,
                    "y": temp.y
                });
            }
            for (i = 0; i < self.userData.length; i++) {
                self.label.links.push({
                    "source": i,
                    "target": i + self.userData.length,
                    "weight": 1
                });
            }

            // instantiate force
            self.force = d3.layout.force()
                .nodes(self.label.nodes)
                .links(self.label.links)
                .size([ self.width, self.height ])
                .linkDistance(0)
                .linkStrength(8)
                .charge(-200)
                .start();

            // render nodes, links
            self.forces = {};

            self.forces.links = self.dataGrp.selectAll("line.link")
                .data(self.force.links())
                .enter()
                .append("svg:line")
                .attr("class", "link")
                .style("stroke", "#000000")
                .style("stroke-width", 0);

            self.forces.nodes = self.dataGrp.selectAll("g")
                .data(self.force.nodes())
                .enter()
                .append("svg:g")
                .attr("class", function (d, i) {
                    return i <= self.userData.length - 1 ? "node"
                        : "label";
                })
                // make labels disappear when datapt radius is zero
                .attr("display", function (d) {
                    return self.radius > 0 ? "inline"
                        : "none";
                });

            self.forces.nodes.append("svg:circle")
                .attr("r", function(d, i) {
                    return i < self.userData.length ?
                        self.radius : 0;
                })
                // only set class/id to valid circles (even)
                .attr("class", function(d, i) {
                    return i < self.userData.length ? "data" : "dummy";
                })
                .attr("id", function(d, i) {
                    return i < self.userData.length ? "pts" : "dummy";
                })
                // set fill color of cluster
                .style("fill", function(d) {
                    return self.getColor(d.Cluster);
                })
                .style("fill-opacity", self.opac)
                .style("stroke-width", 1)
                .style("stroke", "white")
                .attr("cluster", function(d) {
                    return d.Cluster;
                });

            self.forces.nodes.append("svg:text")
                .text(function(d, i) {
                    return i < self.userData.length ? "" : d.KinaseName;
                })
                .style("fill", "black")
                .style("font-family", "sans-serif")
                .style("font-size", "10pt")
                // only set class/id to valid text labels (odd)
                .attr("class", function(d, i) {
                    return i < self.userData.length ? "dummy" : "data";
                }).attr("id", function(d, i) {
                    return i < self.userData.length ? "dummy" : "label";
                });

                // todo: fix this to work on groups only w/text
                d3.selectAll("g.label")
                .call(self.force.drag)
                .on("mousedown", function(d) {
                    d.fixed = true;
                });


            self.updateLink = function() {
                this.attr("x1", function(d) {
                    return d.source.x;
                }).attr("y1", function(d) {
                    return d.source.y;
                }).attr("x2", function(d) {
                    return d.target.x;
                }).attr("y2", function(d) {
                    return d.target.y;
                });
            };

            self.updateNode = function() {
                this.attr("transform", function(d) {
                    return "translate(" + d.x + ", " + d.y + ")";
                });
            };

            self.force.on("tick", function() {
                self.forces.links.call(self.updateLink);
                self.forces.nodes.call(self.updateNode);
            });

        };
    };

    KVM = new KinomeViewModel();

    /* SVG download event
     * using FileSaver.js */
    $('#download').click(function() {
        var that = $(this);
        that.attr('disabled', 'disabled');
        $.ajax({
            url: 'img/kinome.svg',
            dataType: 'text',
            success: function(kinomeBG) {
                var bg_grp = 
                    /<[gG][^>]*>(.|[\r\n])*<\/[gG]>/.exec(kinomeBG)[0];
                var overlay = $('#kinomeDiv').html();
                var dl_svg = overlay.replace('<g id="replace"></g>',
                                             bg_grp);
                var svgBlob = new Blob([dl_svg], {
                    type: 'image/svg+xml;'
                });
                saveAs(svgBlob, 'kinome.svg');
                that.attr('disabled', false);
            },
            error: function(e) {
                alert('Sorry, there was an error processing the SVG file. '
                      + 'Please try again. If the problem persists, '
                      + 'contact the developers.');
                that.attr('disabled', false);
            }
        });
    });

}) (jQuery);
