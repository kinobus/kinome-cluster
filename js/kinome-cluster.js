/* KinomeOverlay.js
 * Copyright 2012 (c) Joseph Lee & Nick Robin
 * This software may be distributed under the MIT License
 * See file LICENSE for details
 *
 * http://code.google.com/p/kinome-overlay
 */

// Heavily used shortcut
pF = parseFloat;
abs = Math.abs;
pow = Math.pow;

(function ($) {

    $("#slope").slider({ min: 0, max: 10, step: 1, value: 5,
        slide: function(event, ui) {
            KVM.slope = ui.value;
            KVM.slopeLabel.text(ui.value);
            KVM.setRadii();
            if (KVM.force) {
                KVM.force.resume();
            }
        }
    });
    $("#yint").slider({ min: -100, max: 100, step: 1, value: 0,
        slide: function(event, ui) {
            KVM.yint = ui.value;
            KVM.yintLabel.text(ui.value);
            KVM.setRadii();
            if (KVM.force) {
                KVM.force.resume();
            }
        }
    });
    $("#opac").slider({ min: 0.1, max: 1, step: .1, value: .8,
        slide: function(event, ui) {
            KVM.opac = ui.value;
            KVM.opacLabel.text(ui.value);
            d3.selectAll(".data#pts")
                .style("fill-opacity", function(d) {
                    return ui.value;
                });
        }
    });

    // Color picker
    $("#inh").colorPicker().change(function() {
        KVM.inhColor = $(this).attr("value");
        KVM.setColors();        
    });
    $("#act").colorPicker().change(function() {
        KVM.actColor = $(this).attr("value");
        KVM.setColors();        
    });
    

    // Demo button
    // SigmaLBarMean Demo
    $("#demo").button();
    $("#demo").click(function() {
        $.getJSON("data/SigmaLBarMean.json", function(demoData) {
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
        self.slope = 5;
        self.yint = 0;

        // set labels for scaling factors
        self.slopeLabel = $("label#slope").text(self.slope);
        self.yintLabel = $("label#yint").text(self.yint);

        // opacity
        self.opac = 0.8;

        // set opacity label
        self.opacLabel = $("label#opac").text(self.opac);

        // color values
        self.inhR = 57;
        self.inhG = 39;
        self.inhB = 91;

        self.actR = 199;
        self.actG = 153;
        self.actB = 0;

        // svg elements
        self.svg = d3.select("#kinome");
        self.dataGrp = d3.select(".data#grp");


        // Color picker
        self.hexFromRGB = function (r, g, b) {
            var hex = [
                r.toString( 16 ),
                g.toString( 16 ),
                b.toString( 16 )
            ];
            $.each( hex, function( nr, val ) {
                if ( val.length === 1 ) {
                    hex[ nr ] = "0" + val;
                }
            });
            return hex.join( "" ).toUpperCase();
        };
        self.inhColor = $("#inh").attr("value");
        self.actColor = $("#act").attr("value");

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
                    temp.Intensity = 0;
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
            .attr("r", function(d) { return 4; })
            .attr("class", "kinase")
            .attr("id", function(d) { return d.GeneID; });

        /* Upload file handle */
        self.userData = [];
        self.reader = new FileReader();

        // Event binding on View: input file-upload
        self.onFileUpload = $("#csv_file").change(function() {
            var upload_file = document.getElementById("csv_file").files;
            for (i = 0; i < upload_file.length; i++) {
                self.reader.readAsText(upload_file[i]);
            }
        });

        // Event triggered by finished file upload
        // called upon completion of reader.readAsText
        self.reader.onloadend = function(e) {

            // parse input data
            var data = self.reader.result.split("\n");
            for (i = 0; i < data.length; i++) {
                data[i] = data[i].split(",");
            }
            self.applyData(data);
        };

        // Return Kinase object by GeneID
        self.getKinaseById = function (geneid) {
            for (i = 0; i < self.kinases.length; i++) {
                if (self.kinases[i].GeneID = geneid) {
                    return self.kinases[i];
                }
            }
            return undefined;
        };

        // Return radius based on intensity
        self.getRadius = function (intensity) {
            var radius = self.slope * intensity * (pow(-1, (intensity < 0))) + self.yint;
            return radius >= 0 ? radius : 0;
        };

        // obtain approriate color for intensity
        self.getColor = function (intensity) {
            if (intensity >= 0) {
                return self.actColor;
            }
            return self.inhColor;
        };

        // change all radii accordingly
        // use radius scaling events for data points
        self.setRadii = function() {
            d3.selectAll(".data#pts")
                .attr("r", function(d) {
                    return self.getRadius(d.Intensity);
                });
            // make labels disappear when datapt radius is zero
            d3.selectAll(".data#label")
                .attr("visibility", function(d) {
                    return self.getRadius(d.Intensity) > 0 ? "visible"
                        : "hidden";
                });
        };

        // change all colors accordingly
        // use color changing events for data points
        self.setColors = function() {

            // set all data node colors
            d3.selectAll(".data#pts")
                .style("fill", function(d) {
                    return self.getColor(d.Intensity);
                });

            // set color samples
            $("#inh").css("background-color", self.inhColor);
            $("#act").css("background-color", self.actColor);

        };

        // purge all intensity data from kinases
        self.clearData = function () {
            self.userData = [];
            for (i = 0; i < self.kinases.length; i++) {
                self.kinases[i].Intensity = 0;
            }
            self.userData = [];
        };


        // parse, plot user uploaded data
        // uses closure of self.userData
        // self.userData should be sufficiently parsed
        // to an array of 2-element arrays:
        // [ [ GeneID, intensity-value ], ... ]
        self.applyData = function (inputData) {
            // sort inputData so smaller radii are visible
            inputData.sort(function(left, right) {
                var l = abs(left[1]);
                var r = abs(right[1]);
                return l == r ? 0 : (l < r ? -1 : 1);
            });
            while (inputData.length > 0) {
                var temp = inputData.pop();
                for (i = 0; i < self.kinases.length; i++) {
                    if (self.kinases[i].GeneID == temp[0]) {
                        self.kinases[i].Intensity = temp[1];
                        self.userData.push(self.kinases[i]);
                    }
                }
            }
            self.setForce();    // run force layout
        };

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
                .attr("visibility", function (d) {
                    return self.getRadius(d.Intensity) > 0 ? "visible"
                        : "hidden";
                });

            self.forces.nodes.append("svg:circle")
                .attr("r", function(d, i) {
                    return i < self.userData.length ?
                        self.getRadius(d.Intensity) : 0;
                })
                // only set class/id to valid circles (even)
                .attr("class", function(d, i) {
                    return i < self.userData.length ? "data" : "dummy";
                })
                .attr("id", function(d, i) {
                    return i < self.userData.length ? "pts" : "dummy";
                })
                .style("fill", function(d) {
                    return self.getColor(d.Intensity);
                })
                .style("fill-opacity", self.opac);

            self.forces.nodes.append("svg:text")
                .text(function(d, i) {
                    return i < self.userData.length ? "" : d.KinaseName;
                })
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

}) (jQuery);
