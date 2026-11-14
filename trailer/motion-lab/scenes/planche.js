/* LKDV trailer — motion-lab/scenes/planche.js : planches de présentation des idées pour Tony (hors film). */
(function () {
  "use strict";
  var M = LKDVM;
  var SNAP = "../qa/snapshots/motion/";
  var IDEES = [
    ["01", "Le fil", "A", "idee-01-fil-seceda", "Un seul trait de lumière, né au Soleil, qui file sur les vrais chemins et devient le logo.", "à garder"],
    ["02", "Le point qui vit", "A", "idee-02-point-sorapis", "Un point de position s'ouvre une fois aux pieds des silhouettes minuscules ; le fil part de là.", "à doser"],
    ["03", "Le cadre qui s'ouvre", "A", "idee-03-cadre", "Tout le début en 2,39:1 ; sur le drop de Seceda, l'image s'ouvre en plein cadre (8 images).", "à garder"],
    ["04", "L'iris", "A", "idee-04-iris", "Le lac grandit depuis le reflet dans la pupille de Léa, bord doux, à la place de P09.", "à garder"],
    ["05", "Les courbes de niveau", "A", "idee-05-courbes-tre-cime", "Un voile de courbes topographiques se dessine une seconde autour du sommet de Tre Cime.", "à éviter"],
    ["06", "La constellation", "A", "idee-06-constellation", "Au bivouac, six vraies étoiles se relient et dessinent le logo dans le ciel : la fin s'annonce.", "à garder"],
    ["07", "La donnée juste", "B", "idee-07-donnee-coureur", "Une seule valeur réelle de l'app, petite, accrochée au sujet par un trait (ici TEMPS 36:18).", "à doser"],
    ["08", "Le total qui fond", "B", "idee-08-poids-lit", "Aucun montant dans la capture E05b : seul « 2,8 kg sur le dos » est réel. Le prix qui fond est à capturer.", "à éviter en l'état"],
    ["09", "Quatre verbes", "C", "idee-09-verbes-raconter", "Rêver, Préparer, Partir, Raconter : un mot par chapitre, Georgia italique, une seconde.", "à éviter"],
    ["10", "Le logo", "A + C", "idee-10-logo-crete", "Le fil trace la crête du logo pendant que les tracés convergent ; variante C : le nom dessous.", "à garder"],
    ["11", "La carte qui annonce", "A", "idee-11-carte", "Pendant la préparation, l'itinéraire se trace sur la carte papier, flou comme elle.", "à doser"],
    ["12", "Le point du Soleil", "A", "idee-12-point-soleil", "L'étincelle du Soleil (image 36) est le point qui se pose en dernier sur le logo.", "à garder"],
  ];
  // recadrages 16:9 des vignettes (sinon le trait fin disparaît à cette taille) : [x, y, largeur]
  var CROP = {
    "01": [860, 380, 1040], "02": [770, 720, 640], "05": [560, 516, 1000], "06": [760, 30, 840],
    "07": [700, 330, 900], "08": [900, 480, 1020], "09": [0, 660, 760], "10": [480, 300, 960], "11": [1160, 140, 760],
  };
  var FAM = { A: "A · SANS TEXTE", B: "B · CHIFFRES DE L'APP", C: "C · DES MOTS", "A + C": "A + VARIANTE C" };
  function wrap(c, txt, maxW) {
    var words = txt.split(" "),
      lines = [""];
    words.forEach(function (w) {
      var t = lines[lines.length - 1] ? lines[lines.length - 1] + " " + w : w;
      if (c.measureText(t).width > maxW && lines[lines.length - 1]) lines.push(w);
      else lines[lines.length - 1] = t;
    });
    return lines;
  }
  M.scenes["planche"] = {
    images: function (n, p) {
      var o = {};
      IDEES.slice(p.from, p.from + 6).forEach(function (d) {
        o[d[0]] = SNAP + d[3] + ".jpg";
      });
      return o;
    },
    draw: function (ctx, n, im, p) {
      ctx.fillStyle = "#0B1F17";
      // (vignettes 01, 02, 05, 06, 07, 08, 09, 10, 11 : détail recadré de l'image clé)
      ctx.fillRect(0, 0, M.W, M.H);
      var S = function (a) {
        return M.rgba(M.STONE, a);
      };
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.font = "600 14px Inter";
      ctx.letterSpacing = "4px";
      ctx.fillStyle = S(0.6);
      ctx.fillText("LKDV · TRAILER 60 S · MOTION DESIGN · PROPOSITIONS " + (p.from ? "7 À 12" : "1 À 6") + " SUR 12", 60, 62);
      ctx.letterSpacing = "0px";
      ctx.font = "italic 30px Georgia";
      ctx.fillStyle = S(0.95);
      ctx.fillText(p.from ? "La donnée, les mots, la fin." : "Un seul fil sous tout le film.", 60, 104);
      var tw = 576,
        th = 324,
        gx = 36,
        x0 = 60,
        y0 = 140,
        rowH = 466;
      IDEES.slice(p.from, p.from + 6).forEach(function (d, i) {
        var x = x0 + (i % 3) * (tw + gx),
          y = y0 + Math.floor(i / 3) * rowH;
        var cr = CROP[d[0]];
        if (cr) ctx.drawImage(im[d[0]], cr[0], cr[1], cr[2], (cr[2] * 9) / 16, x, y, tw, th);
        else ctx.drawImage(im[d[0]], x, y, tw, th);
        // numéro + nom
        ctx.font = "300 30px Inter";
        ctx.fillStyle = S(0.55);
        ctx.fillText(d[0], x, y + th + 40);
        ctx.font = "600 21px Inter";
        ctx.fillStyle = S(0.96);
        ctx.fillText(d[1], x + 48, y + th + 38);
        // famille, à droite
        ctx.font = "600 12px Inter";
        ctx.letterSpacing = "2.5px";
        ctx.textAlign = "right";
        ctx.fillStyle = d[2] === "A" ? "#9BBDA7" : d[2] === "B" ? "#D4CCC0" : "#E8E2D9";
        ctx.fillText(FAM[d[2]], x + tw, y + th + 36);
        ctx.textAlign = "left";
        ctx.letterSpacing = "0px";
        // phrase
        ctx.font = "400 15.5px Inter";
        ctx.fillStyle = S(0.78);
        wrap(ctx, d[4], tw).forEach(function (l, k) {
          ctx.fillText(l, x, y + th + 66 + k * 22);
        });
        // avis
        ctx.font = "italic 17px Georgia";
        ctx.fillStyle = S(0.92);
        ctx.fillText("Avis : " + d[5], x, y + th + 118);
      });
    },
  };
})();
