// Diana Alves & Rui Vaz - CG 2020/2021

///////////////////////////////
// VARIAVEIS DE CONFIGURAÇÃO //
///////////////////////////////
var nr_pratos = 2;  // Escolher aqui o número de pratos a colocar (máximo de 8)
var velocidade_carrinho = 1; // Escolher aqui a velocidade do carrinho (1 é a velocidade normal)
var velocidade_tapete = 1; // Escolher aqui a velocidade de rotação do tapete com os pratos (1 é a velocidade normal)
var colisao_carrinho = false; // Escolher aqui se fica ativada a colisão contra o carrinho (true para ativada)
var carrinho_apanha_prato = true; // Escolher aqui se o carrinho apanha o prato ao passar pelo personagem (true para ativado)

let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
  _APP = new Aplicacao();
});

window.addEventListener('resize', () => {
  OnWindowResize();
}, false);

import {FBXLoader} from './FBXLoader.js';
import {GLTFLoader} from './GLTFLoader.js';


class BasicCharacterControllerProxy {
  constructor(animations) {
    this._animations = animations;
  }

  get animations() {
    return this._animations;
  }
};


class BasicCharacterController {
  constructor(params) {
    this._Init(params);
  }

  _Init(params) {
    this._params = params;
    this._decceleration = new THREE.Vector3(-0.0005, -0.0001, -5.0);
    this._acceleration = new THREE.Vector3(1, 0.25, 50.0);
    this._velocity = new THREE.Vector3(0, 0, 0);
    this._position = new THREE.Vector3();

    this._animations = {};
    this._input = new BasicCharacterControllerInput();
    this._stateMachine = new CharacterFSM(
        new BasicCharacterControllerProxy(this._animations));

    this._LoadModels();
  }

  _LoadModels() {
    const loader = new FBXLoader();
    loader.setPath('./Objetos/');
    loader.load('Mannequin.fbx', (objeto) => {
      objeto.scale.setScalar(0.1);
        objeto.traverse(function (child) {    
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
      });
      
      objeto.position.z = -30;

      boneco = objeto;
      cena.add(boneco);
      cena.add( AreaColisao );

      camara_ortografica.position.x = boneco.position.x;
      camara_ortografica.position.z = boneco.position.z;

      mixerAnimacao = new THREE.AnimationMixer(boneco);

      var manager = new THREE.LoadingManager();
      manager.onLoad = () => {
        this._stateMachine.SetState('idle');
      };

      const _OnLoad = (animName, anim) => {
        const clip = anim.animations[0];
        const action = mixerAnimacao.clipAction(clip);
  
        this._animations[animName] = {
          clip: clip,
          action: action,
        };
      };

      const loader = new FBXLoader(manager);
      loader.setPath('./Objetos/');
      loader.load('Walk.fbx', (a) => { _OnLoad('walk', a); });
      loader.load('Idle.fbx', (a) => { _OnLoad('idle', a); });
      loader.load('Texting.fbx', (a) => { _OnLoad('idle_prato', a); });
      loader.load('Texting And Walking.fbx', (a) => { _OnLoad('walk_prato', a); });
    });
  }

  get Position() {
    return this._position;
  }

  get Rotation() {
    if (!boneco) {
      return new THREE.Quaternion();
    }
    return boneco.quaternion;
  }

  Update(timeInSeconds) {
    if (!this._stateMachine._currentState) {
      return;
    }

    this._stateMachine.Update(timeInSeconds, this._input);

    const velocity = this._velocity;
    const frameDecceleration = new THREE.Vector3(
        velocity.x * this._decceleration.x,
        velocity.y * this._decceleration.y,
        velocity.z * this._decceleration.z
    );
    frameDecceleration.multiplyScalar(timeInSeconds);
    frameDecceleration.z = Math.sign(frameDecceleration.z) * Math.min(
        Math.abs(frameDecceleration.z), Math.abs(velocity.z));

    velocity.add(frameDecceleration);

    const controlObject = boneco;
    const _Q = new THREE.Quaternion();
    const _A = new THREE.Vector3();
    const _R = controlObject.quaternion.clone();

    const acc = this._acceleration.clone();

    if (teclas.frente) {
      camara_ortografica.position.x = boneco.position.x;
      camara_ortografica.position.z = boneco.position.z;
      if (!colisao) {
        velocity.z += acc.z * timeInSeconds;
      }
      else
      {
        velocity.z -= 4 * acc.z * timeInSeconds;
        colisao = false;
      }
    }
    if (teclas.tras) {
      camara_ortografica.position.x = boneco.position.x;
      camara_ortografica.position.z = boneco.position.z;
      if (!colisao) {
        velocity.z -= acc.z * timeInSeconds;
      }
      else
      {
        velocity.z += 4 * acc.z * timeInSeconds;
        colisao = false;
      }
    }
    if (teclas.esquerda) {
      _A.set(0, 1, 0);
      _Q.setFromAxisAngle(_A, 4.0 * Math.PI * timeInSeconds * this._acceleration.y);
      _R.multiply(_Q);
    }
    if (teclas.direita) {
      _A.set(0, 1, 0);
      _Q.setFromAxisAngle(_A, 4.0 * -Math.PI * timeInSeconds * this._acceleration.y);
      _R.multiply(_Q);
    }

    AreaColisao.quaternion.copy(_R);
    controlObject.quaternion.copy(_R);

    const oldPosition = new THREE.Vector3();
    oldPosition.copy(controlObject.position);

    const frente = new THREE.Vector3(0, 0, 1);
    frente.applyQuaternion(controlObject.quaternion);
    frente.normalize();

    const sideways = new THREE.Vector3(1, 0, 0);
    sideways.applyQuaternion(controlObject.quaternion);
    sideways.normalize();

    sideways.multiplyScalar(velocity.x * timeInSeconds);
    frente.multiplyScalar(velocity.z * timeInSeconds);

    controlObject.position.add(frente);
    controlObject.position.add(sideways);

    this._position.copy(controlObject.position);
    AreaColisao.position.x = controlObject.position.x;
    AreaColisao.position.z = controlObject.position.z;

    if (mixerAnimacao) {
      mixerAnimacao.update(timeInSeconds);
    } 
  }
};

class BasicCharacterControllerInput {
  constructor() {
    this._Init();    
  }

  _Init() {
    document.addEventListener('keydown', (e) => this._onKeyDown(e), false);
    document.addEventListener('keyup', (e) => this._onKeyUp(e), false);
  }

  _onKeyDown(event) {
    if (!jogo_em_pausa)
      switch (event.keyCode) {
        case 87: // w
          teclas.frente = true;
          break;
        case 65: // a
          teclas.esquerda = true;
          break;
        case 83: // s
          teclas.tras = true;
          break;
        case 68: // d
          teclas.direita = true;
          break;
        case 32: // espaco
          if (estado == "idle_prato" || estado == "walk_prato"){
            largaPrato();
            if (prato_atual == null){
              teclas.espaco = true;
            }
          }
          else if (estado == "idle" || estado == "walk"){
            pegaPrato();
            if (prato_atual != null){
              teclas.espaco = true;
            }
          }
          break;
        case 80: // p
          camara_perspetiva.zoom = 1;
          camara_perspetiva.updateProjectionMatrix();
          camara_perspetiva_ativa = true;
          break;
        case 79: // o
          idealOffset_x = -15;
          idealOffset_y = 20;
          idealOffset_z = -30;
          idealLookat_x = 0;
          idealLookat_y = 10;
          idealLookat_z = 10;
          camara_ortografica.zoom = 1;
          camara_ortografica.updateProjectionMatrix();
          camara_perspetiva_ativa = false;
          break;
      }
    switch (event.keyCode) {
      case 49: // 1
        if (luz_direcional_ativa) {
          cena.remove(luz_direcional);
          luz_direcional_ativa = false;
        }
        else {
          cena.add(luz_direcional);
          luz_direcional_ativa = true;
        }
        break;
      case 50: // 2
        if (luz_ambiente_ativa) {
          cena.remove(luz_ambiente);
          luz_ambiente_ativa = false;
        }
        else {
          cena.add(luz_ambiente);
          luz_ambiente_ativa = true;
        }
        break;
      case 51: // 3
        if (luz_foco_ativa) {
          cena.remove(luz_farol);
          luz_foco_ativa = false;
        }
        else {
          cena.add(luz_farol);
          luz_foco_ativa = true;
        }
        break;
      case 52: // 4
        if (luz_pontual_ativa) {
          cena.remove(luz_pontual);
          luz_pontual_ativa = false;
        }
        else {
          cena.add(luz_pontual);
          luz_pontual_ativa = true;
        }
        break;
      case 37: // seta esquerda
        teclas.seta_esquerda = true;
        break;
      case 39: // seta direita
        teclas.seta_direita = true;
        break;
      case 38: // seta cima
        teclas.seta_cima = true;
        break;
      case 40: // seta baixo
        teclas.seta_baixo = true;
        break;
      case 48: // 0
        if (!luz_direcional_ativa) {
          cena.add(luz_direcional);
          luz_direcional_ativa = true;
        }
        if (!luz_ambiente_ativa) {
          cena.add(luz_ambiente);
          luz_ambiente_ativa = true;
        }
        if (luz_foco_ativa) {
          cena.remove(luz_foco);
          luz_foco_ativa = false;
        }
        if (luz_pontual_ativa) {
          cena.remove(luz_pontual);
          luz_pontual_ativa = false;
        }
        break;
      case 73: // i
        if(instrucoes.className == "")
          instrucoes.className = "fechar";
        else
        instrucoes.className = "";
        break;
      case 187: case 107: // +
        teclas.mais = true;
        break;
      case 189: case 109: // -
        teclas.menos = true;
        break;
      case 82: // r
        recomecaJogo();
        break;
      case 13: // enter
        pausaJogo();
        break;
    }
  }

  _onKeyUp(event) {
    switch(event.keyCode) {
      case 87: // w
        teclas.frente = false;
        break;
      case 65: // a
        teclas.esquerda = false;
        break;
      case 83: // s
        teclas.tras = false;
        break;
      case 68: // d
        teclas.direita = false;
        break;
      case 32: // espaco
        teclas.espaco = false;
        break;
      case 37: // seta esquerda
        teclas.seta_esquerda = false;
        break;
      case 39: // seta direita
        teclas.seta_direita = false;
        break;
      case 38: // seta cima
        teclas.seta_cima = false;
        break;
      case 40: // seta baixo
        teclas.seta_baixo = false;
        break;
      case 187: case 107: // +
        teclas.mais = false;
        break;
      case 189: case 109: // -
        teclas.menos = false;
        break;
    }
  }
};


class FiniteStateMachine {
  constructor() {
    this._states = {};
    this._currentState = null;
  }

  _AddState(name, type) {
    this._states[name] = type;
  }

  SetState(name) {
    const prevState = this._currentState;
    
    if (prevState) {
      if (prevState.Name == name) {
        return;
      }
      prevState.Exit();
    }

    const state = new this._states[name](this);

    this._currentState = state;
    estado = state.Name;
    state.Enter(prevState);
  }

  Update(timeElapsed, input) {
    if (this._currentState) {
      this._currentState.Update(timeElapsed, input);
    }
  }
};


class CharacterFSM extends FiniteStateMachine {
  constructor(proxy) {
    super();
    this._proxy = proxy;
    this._Init();
  }

  _Init() {
    this._AddState('idle', IdleState);
    this._AddState('walk', WalkState);
    this._AddState('walk_prato', WalkPratoState);
    this._AddState('idle_prato', IdlePratoState);
  }
};


class State {
  constructor(parent) {
    this._parent = parent;
  }

  Enter() {}
  Exit() {}
  Update() {}
};

class WalkState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'walk';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['walk'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.enabled = true;

      curAction.time = 0.0;
      curAction.setEffectiveTimeScale(1.0);
      curAction.setEffectiveWeight(1.0);

      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Exit() {
  }

  Update(timeElapsed, input) {
    if (teclas.frente || teclas.tras) {
      if (teclas.espaco) {
        teclas.espaco = false;
        this._parent.SetState('walk_prato');
      }
      return;
    }

    this._parent.SetState('idle');
  }
};

class WalkPratoState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'walk_prato';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['walk_prato'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.enabled = true;

      curAction.time = 0.0;
      curAction.setEffectiveTimeScale(1.0);
      curAction.setEffectiveWeight(1.0);

      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Exit() {
  }

  Update(timeElapsed, input) {
    if (teclas.frente || teclas.tras) {
      if (teclas.espaco) {
        teclas.espaco = false;
        this._parent.SetState('walk');
      }
      return;
    }

    this._parent.SetState('idle_prato');
  }
};

class IdleState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'idle';
  }

  Enter(prevState) {
    const idleAction = this._parent._proxy._animations['idle'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;
      idleAction.time = 0.0;
      idleAction.enabled = true;
      idleAction.setEffectiveTimeScale(1.0);
      idleAction.setEffectiveWeight(1.0);
      idleAction.crossFadeFrom(prevAction, 0.5, true);
      idleAction.play();
    } else {
      idleAction.play();
    }
  }

  Exit() {
  }

  Update(_, input) {
    if (teclas.frente || teclas.tras) {
      this._parent.SetState('walk');
    } else if (teclas.espaco) {
      teclas.espaco = false;
      this._parent.SetState('idle_prato');
    }
  }
};

class IdlePratoState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'idle_prato';
  }

  Enter(prevState) {
    const idleAction = this._parent._proxy._animations['idle_prato'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;
      idleAction.time = 0.0;
      idleAction.enabled = true;
      idleAction.setEffectiveTimeScale(1.0);
      idleAction.setEffectiveWeight(1.0);
      idleAction.crossFadeFrom(prevAction, 0.5, true);
      idleAction.play();
    } else {
      idleAction.play();
    }
  }

  Exit() {
  }

  Update(_, input) {
    if (teclas.frente || teclas.tras) {
      this._parent.SetState('walk_prato');
    } else if (teclas.espaco) {
      teclas.espaco = false;
      this._parent.SetState('idle');
    }
  }
};

class ThirdPersonCamera {
  constructor(params) {
    this._params = params;

    this._currentPosition = new THREE.Vector3();
    this._currentLookat = new THREE.Vector3();
  }

  _CalculateIdealOffset() {
    const idealOffset = new THREE.Vector3(idealOffset_x, idealOffset_y, idealOffset_z);
    idealOffset.applyQuaternion(this._params.target.Rotation);
    idealOffset.add(this._params.target.Position);
    return idealOffset;
  }

  _CalculateIdealLookat() {
    const idealLookat = new THREE.Vector3(idealLookat_x, idealLookat_y, idealLookat_z);
    idealLookat.applyQuaternion(this._params.target.Rotation);
    idealLookat.add(this._params.target.Position);
    return idealLookat;
  }

  Update(timeElapsed) {
    const idealOffset = this._CalculateIdealOffset();
    const idealLookat = this._CalculateIdealLookat();

    const t = 1.0 - Math.pow(0.001, timeElapsed);

    this._currentPosition.lerp(idealOffset, t);
    this._currentLookat.lerp(idealLookat, t);

    camara_perspetiva.position.copy(this._currentPosition);
    camara_perspetiva.lookAt(this._currentLookat);
  }
}


class Aplicacao {
  constructor() {
    this._Inicializar();
  }

  _Inicializar() {
    cena.add(luz_direcional);
    cena.add(luz_ambiente);

    const loader = new THREE.CubeTextureLoader();
    const texture = loader.load([
        './Recursos/old_hall.right.png',
        './Recursos/old_hall.left.png',
        './Recursos/old_hall.up.png',
        './Recursos/old_hall.down.png',
        './Recursos/old_hall.front.png',
        './Recursos/old_hall.back.png',
    ]);
    texture.encoding = THREE.sRGBEncoding;
    cena.background = texture;

    cena.add(chao);
    chao.add(balcao);
    collidableMeshList.push(balcao);
    chao.add(mesas);

    chao.add(carrinho);
    tapete_balcao.add(relogio);

    //texto_temp.position.set(0,17,-30);
    //cena.add(texto_temp);

    this._mixers = [];
    this._previousRAF = null;

    CarregaColisaoMesas();
    CarregarPratos();

    this._CarregarBoneco();

    this._RAF();
  }

  _CarregarBoneco() {
    const params = {
      camara: camara_perspetiva,
      scene: cena,
    }
    this._controls = new BasicCharacterController(params);

    this._thirdPersonCamera = new ThirdPersonCamera({
      target: this._controls,
    });
  }

  _RAF() {
    requestAnimationFrame((t) => {
      if (this._previousRAF === null) {
        this._previousRAF = t;
      }

      this._RAF();

      if (camara_perspetiva_ativa && !jogo_em_pausa) {
        if (teclas.mais) {
          if (camara_perspetiva.zoom < 2) {
            camara_perspetiva.zoom += 0.01;
            camara_perspetiva.updateProjectionMatrix();  
          }
        }     
        if (teclas.menos) {
          if (camara_perspetiva.zoom > 0.4) {
            camara_perspetiva.zoom -= 0.01;
            camara_perspetiva.updateProjectionMatrix();  
          }
        }
        if (teclas.seta_esquerda) {
          var x = idealOffset_x;
          var z = idealOffset_z;
          idealOffset_x = (x-idealLookat_x)*Math.cos(0.1)-(z-idealLookat_z)*Math.sin(0.1)+idealLookat_x;
          idealOffset_z = (x-idealLookat_x)*Math.sin(0.1)+(z-idealLookat_z)*Math.cos(0.1)+idealLookat_z;
        }
        if (teclas.seta_direita) {
          var x = idealOffset_x;
          var z = idealOffset_z;
          idealOffset_x = (x-idealLookat_x)*Math.cos(-0.1)-(z-idealLookat_z)*Math.sin(-0.1)+idealLookat_x;
          idealOffset_z = (x-idealLookat_x)*Math.sin(-0.1)+(z-idealLookat_z)*Math.cos(-0.1)+idealLookat_z;
        }
        if (teclas.seta_cima) {
          if (idealOffset_y < 50)
          idealOffset_y += 1;
        }
        if (teclas.seta_baixo) {
          if (idealOffset_y > 3)
          idealOffset_y -= 1;
        }
        renderer.render(cena, camara_perspetiva);
      }
      else if (!jogo_em_pausa) {
        if (teclas.mais) {
          if (camara_ortografica.zoom < 2.5) {
            camara_ortografica.zoom += 0.01;
            camara_ortografica.updateProjectionMatrix();  
          }
        }     
        if (teclas.menos) {
          if (camara_ortografica.zoom > 0.4) {
            camara_ortografica.zoom -= 0.01;
            camara_ortografica.updateProjectionMatrix();  
          }
        }
        if (teclas.seta_esquerda) {
          camara_ortografica.position.x -= 0.5;
        }
        if (teclas.seta_direita) {
          camara_ortografica.position.x += 0.5;
        }
        if (teclas.seta_cima) {
          camara_ortografica.position.z -= 0.5;
        }
        if (teclas.seta_baixo) {
          camara_ortografica.position.z += 0.5;
        }
        renderer.render(cena, camara_ortografica);
      }

      colisao = false;

      var vec1 = new THREE.Vector3();
      AreaColisao.getWorldPosition(vec1);

      var originPoint = vec1.clone();
      
      for (var vertexIndex = 0; vertexIndex < AreaColisao.geometry.vertices.length; vertexIndex++)
      {		
        var localVertex = AreaColisao.geometry.vertices[vertexIndex].clone();
        var globalVertex = localVertex.applyMatrix4( AreaColisao.matrix );
        var directionVector = globalVertex.sub( vec1 );
        
        var ray = new THREE.Raycaster( originPoint, directionVector.clone().normalize() );
        var collisionResults = ray.intersectObjects( collidableMeshList );
        if ( collisionResults.length > 0 && collisionResults[0].distance < directionVector.length() ) 
        {
          colisao = true;
        }
      }

      this._Step(t - this._previousRAF);
      this._previousRAF = t;
    });
  }

  _Step(timeElapsed) {
    const timeElapsedS = timeElapsed * 0.001;
    if (this._mixers) {
      this._mixers.map(m => m.update(timeElapsedS));
    }

    if (this._controls) {
      this._controls.Update(timeElapsedS);
    }

    this._thirdPersonCamera.Update(timeElapsedS);

    if (!jogo_em_pausa)
      tapete_balcao.rotation.y += velocidade_tapete * 0.005;

      if(ligacao_relogio.rotation.x <= -0.75)
          sentido_pendulo = true;
      else if (ligacao_relogio.rotation.x >= 0.75)
          sentido_pendulo = false;

      if(sentido_pendulo)
        ligacao_relogio.rotation.x += velocidade_tapete * 0.02;
      else
        ligacao_relogio.rotation.x -= velocidade_tapete * 0.02;
      
      barra.rotation.y += velocidade_carrinho * 0.05;
      barra2.rotation.y += velocidade_carrinho * 0.05;
      
      if (carrinho.position.z <= -30)
      {
        carrinho.position.x += velocidade_carrinho * 0.15;
        carrinho.lookAt(30,0,-30);
      }
      if (carrinho.position.x >= 30)
      {
        carrinho.lookAt(30,0,30);
        carrinho.position.z += velocidade_carrinho * 0.15;
      }
      if (carrinho.position.z >= 30)
      {
        carrinho.lookAt(-30,0,30);
        carrinho.position.x -= velocidade_carrinho * 0.15;
      }
      if (carrinho.position.x <= -30)
      {
        carrinho.lookAt(-30,0,-30);
        carrinho.position.z -= velocidade_carrinho * 0.15;
      }
      if(carrinho_apanha_prato)
        apanhaPrato();

      //cena.remove(texto_temp);
      //texto_temp = fazTexto( " " + minute + ":" + second + " ", { fontsize: 24, borderColor: {r:255, g:0, b:0, a:1.0}, backgroundColor: {r:255, g:100, b:100, a:0.8} } );
      //cena.add(texto_temp);
      //texto_temp.position.set(0,17,-30);
  }
}


var cena = new THREE.Scene();

var renderer = new THREE.WebGLRenderer({antialias: true,});
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth - 15, window.innerHeight - 15);
document.body.appendChild(renderer.domElement);


var jogo_iniciado = false;
var jogo_em_pausa = true;

//////////////////////////
// Cliques em mensagens //
//////////////////////////
var instrucoes = document.getElementById("instrucoes");
var botao_fechar = document.getElementById("botao-fechar");
botao_fechar.onclick = function () {
  instrucoes.className = "fechar";
};

var inicio = document.getElementById("inicio");
var botao_comecar = document.getElementById("botao-comecar");
botao_comecar.onclick = function () {
  inicio.className = "fechar";
  jogo_iniciado = true;
  jogo_em_pausa = false;
};

var pausa = document.getElementById("pausa");
var botao_continuar = document.getElementById("botao-continuar");
botao_continuar.onclick = function () {
  pausaJogo();
};

var ganhou = document.getElementById("ganhou");
var botao_recomecar = document.getElementById("botao-recomecar");
botao_recomecar.onclick = function () {
  ganhou.className = "";
  recomecaJogo();
};

/////////////
// CAMARAS //
/////////////
var camara_perspetiva = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
camara_perspetiva.position.set(25, 10, 25);
var alcance_camara_orto = 20;
var camara_ortografica = new THREE.OrthographicCamera(-(window.innerWidth/window.innerHeight)*alcance_camara_orto, (window.innerWidth/window.innerHeight)*alcance_camara_orto, alcance_camara_orto, -alcance_camara_orto, 0.1, 25);
camara_ortografica.position.set(0, 20, 0);
camara_ortografica.lookAt(0, 0, 0);

var idealOffset_x = -15;
var idealOffset_y = 20;
var idealOffset_z = -30;
var idealLookat_x = 0;
var idealLookat_y = 10;
var idealLookat_z = 10;

var camara_perspetiva_ativa = true;

/////////////
//  LUZES  //
/////////////
var luz_direcional_ativa = true;
var luz_ambiente_ativa = true;
var luz_foco_ativa = false;
var luz_pontual_ativa = false;
var luz_direcional = new THREE.DirectionalLight(0xffffff, 1);
  luz_direcional.position.set(-100, 100, 100);
  luz_direcional.target.position.set(0, 0, 0);
  luz_direcional.castShadow = true;
  luz_direcional.shadow.bias = -0.001;
  luz_direcional.shadow.mapSize.width = 4096;
  luz_direcional.shadow.mapSize.height = 4096;
  luz_direcional.shadow.camera.near = 0.1;
  luz_direcional.shadow.camera.far = 500.0;
  luz_direcional.shadow.camera.left = 110;
  luz_direcional.shadow.camera.right = -110;
  luz_direcional.shadow.camera.top = 110;
  luz_direcional.shadow.camera.bottom = -110;
var luz_ambiente = new THREE.AmbientLight(0xffffff, 0.25);
var luz_foco = new THREE.SpotLight(0xffffff, 1);
  luz_foco.position.set(0,40, 0);
  luz_foco.target.position.set(0, 0, 0);
  luz_foco.castShadow = true;
  luz_foco.shadow.bias = -0.001;
  luz_foco.shadow.mapSize.width = 4096;
  luz_foco.shadow.mapSize.height = 4096;
  luz_foco.shadow.camera.near = 0.1;
  luz_foco.shadow.camera.far = 500.0;
  luz_foco.shadow.camera.left = 110;
  luz_foco.shadow.camera.right = -110;
  luz_foco.shadow.camera.top = 110;
  luz_foco.shadow.camera.bottom = -110;
var luz_pontual = new THREE.PointLight(0xffffff, 1);
  luz_pontual.position.set(0, 40, 0);
  luz_pontual.castShadow = true;
  luz_pontual.shadow.bias = -0.001;
  luz_pontual.shadow.mapSize.width = 4096;
  luz_pontual.shadow.mapSize.height = 4096;
  luz_pontual.shadow.camera.near = 0.1;
  luz_pontual.shadow.camera.far = 500.0;
  luz_pontual.shadow.camera.left = 110;
  luz_pontual.shadow.camera.right = -110;
  luz_pontual.shadow.camera.top = 110;
  luz_pontual.shadow.camera.bottom = -110;


var colisao = false;
var AreaColisao;
var collidableMeshList = [];

var colisaoGeometry = new THREE.CylinderGeometry(3,3,18,6);
var wireMaterial = new THREE.MeshBasicMaterial( { color: 0x000000, wireframe:true, opacity:0, transparent:true } );
AreaColisao = new THREE.Mesh( colisaoGeometry, wireMaterial );
AreaColisao.position.set(0, 9, -30);

var mesas_em_falta = 0;

var minute = 0;
var second = 0;
var millisecond = 0;
var cron;

var boneco;
var mixerAnimacao;

var teclas = {
  frente: false,
  tras: false,
  esquerda: false,
  direita: false,
  espaco: false,
  mais: false,
  menos: false,
  seta_esquerda: false,
  seta_direita: false,
  seta_cima: false,
  seta_baixo: false,
};
var estado;
var prato_atual;

// Chão do cenário
var textura_chao =  new THREE.TextureLoader().load('./Recursos/azulejo.jpg');
textura_chao.wrapS = textura_chao.wrapT = THREE.RepeatWrapping;
textura_chao.repeat.set(10, 10);

var chao = new THREE.Mesh(
  new THREE.BoxGeometry(150, 0.00001, 150), 
  new THREE.MeshStandardMaterial({color: 0xffffff, map: textura_chao}));
chao.castShadow = false;
chao.receiveShadow = true;

///////////////////////
// Objetos Complexos //
///////////////////////
// Mesas
var altura_mesas = 7;
var largura_mesas = 10;
var comprimento_mesas = 20;
var mesa = new THREE.Mesh();
var geometria_tampo_mesa = new THREE.BoxGeometry(comprimento_mesas, altura_mesas/10, largura_mesas);
var material_tampo_mesa = new THREE.MeshStandardMaterial({color: 0xffffff, map: new THREE.TextureLoader().load('./Recursos/madeira1.jpg')});
var tampo_mesa = new THREE.Mesh(geometria_tampo_mesa, material_tampo_mesa);
tampo_mesa.castShadow = true;
tampo_mesa.receiveShadow = true;
tampo_mesa.position.y = altura_mesas;
mesa.add(tampo_mesa);
var geometria_pe_mesa = new THREE.BoxGeometry(comprimento_mesas/20, altura_mesas, largura_mesas/20);
var material_pe_mesa = new THREE.MeshStandardMaterial({color: 0x0000ff});
material_pe_mesa = material_tampo_mesa;
var pe_mesa = new THREE.Mesh(geometria_pe_mesa, material_pe_mesa);
pe_mesa.castShadow = true;
pe_mesa.receiveShadow = true;
pe_mesa.position.y = altura_mesas/2;
pe_mesa.position.x = (comprimento_mesas/2)-(comprimento_mesas/20);
pe_mesa.position.z = (largura_mesas/2)-(largura_mesas/20);
mesa.add(pe_mesa);
var pe_mesa = new THREE.Mesh(geometria_pe_mesa, material_pe_mesa);
pe_mesa.castShadow = true;
pe_mesa.receiveShadow = true;
pe_mesa.position.y = altura_mesas/2;
pe_mesa.position.x = -(comprimento_mesas/2)+(comprimento_mesas/20);
pe_mesa.position.z = (largura_mesas/2)-(largura_mesas/20);
mesa.add(pe_mesa);
var pe_mesa = new THREE.Mesh(geometria_pe_mesa, material_pe_mesa);
pe_mesa.castShadow = true;
pe_mesa.receiveShadow = true;
pe_mesa.position.y = altura_mesas/2;
pe_mesa.position.x = (comprimento_mesas/2)-(comprimento_mesas/20);
pe_mesa.position.z = -(largura_mesas/2)+(largura_mesas/20);
mesa.add(pe_mesa);
var pe_mesa = new THREE.Mesh(geometria_pe_mesa, material_pe_mesa);
pe_mesa.castShadow = true;
pe_mesa.receiveShadow = true;
pe_mesa.position.y = altura_mesas/2;
pe_mesa.position.x = -(comprimento_mesas/2)+(comprimento_mesas/20);
pe_mesa.position.z = -(largura_mesas/2)+(largura_mesas/20);
mesa.add(pe_mesa);

var distancia_mesas = 50;
var mesas = new THREE.Mesh();
var mesas_array = [];
mesas_array[0] = mesa.clone();
mesas_array[0].position.x = distancia_mesas;
mesas_array[0].position.z = 0;
mesas.add(mesas_array[0]);
mesas_array[1] = mesa.clone();
mesas_array[1].position.x = distancia_mesas;
mesas_array[1].position.z = -distancia_mesas;
mesas.add(mesas_array[1]);
mesas_array[2] = mesa.clone();
mesas_array[2].position.x = distancia_mesas;
mesas_array[2].position.z = distancia_mesas;
mesas.add(mesas_array[2]);
mesas_array[3] = mesa.clone();
mesas_array[3].position.x = -distancia_mesas;
mesas_array[3].position.z = 0;
mesas.add(mesas_array[3]);
mesas_array[4] = mesa.clone();
mesas_array[4].position.x = -distancia_mesas;
mesas_array[4].position.z = -distancia_mesas;
mesas.add(mesas_array[4]);
mesas_array[5] = mesa.clone();
mesas_array[5].position.x = -distancia_mesas;
mesas_array[5].position.z = distancia_mesas;
mesas.add(mesas_array[5]);
mesas_array[6] = mesa.clone();
mesas_array[6].position.x = 0;
mesas_array[6].position.z = -distancia_mesas;
mesas.add(mesas_array[6]);
mesas_array[7] = mesa.clone();
mesas_array[7].position.x = 0;
mesas_array[7].position.z = distancia_mesas;
mesas.add(mesas_array[7]);
// Margem à volta das mesas
var outlineMesh = [];
var outlineMaterial1 = new THREE.MeshBasicMaterial( { color: 0xff0000, side: THREE.BackSide } );
var outlineMesh1 = new THREE.Mesh( geometria_tampo_mesa, outlineMaterial1 );
var outlineMaterialTrans = new THREE.MeshBasicMaterial( { color: 0x000000, opacity:0, transparent:true} );
var outlineMeshTrans = new THREE.Mesh( geometria_tampo_mesa, outlineMaterialTrans );
outlineMesh1.position.y = altura_mesas;
outlineMesh1.scale.multiplyScalar(1.05);

// Balcão
var geometria_base = new THREE.CylinderGeometry(20,15,7,40);
var geometria_topo = new THREE.CylinderGeometry(21,21,0.7,60);
var geometria_tapete = new THREE.CylinderGeometry(20,20,0.20,60);
var geometria_lugares = new THREE.CylinderGeometry(3,3,0.05,30);
var material = new THREE.MeshStandardMaterial({color: 0xff0000});
material = new THREE.MeshStandardMaterial({color: 0xffffff, map: new THREE.TextureLoader().load('./Recursos/metal.jpg')});
var material_tapete = new THREE.MeshStandardMaterial({color: 0x964B00});
material_tapete = new THREE.MeshStandardMaterial({color: 0xffffff, map: new THREE.TextureLoader().load('./Recursos/madeira2.jpg')});
var material_lugares = new THREE.MeshStandardMaterial({color: 0xffffff});
var base_balcao = new THREE.Mesh(geometria_base, material);
base_balcao.castShadow = true;
base_balcao.receiveShadow = true;
var topo_balcao = new THREE.Mesh(geometria_topo, material);
topo_balcao.castShadow = true;
topo_balcao.receiveShadow = true;
var tapete_balcao = new THREE.Mesh(geometria_tapete,material_tapete);
tapete_balcao.castShadow = true;
tapete_balcao.receiveShadow = true;
var lugar_balcao = new THREE.Mesh(geometria_lugares,material_lugares);
lugar_balcao.receiveShadow = true;

var balcao = new THREE.Mesh();
balcao.add(base_balcao);
base_balcao.position.y = 3.5;
balcao.add(topo_balcao);
collidableMeshList.push(topo_balcao);
topo_balcao.position.y = 7;
balcao.add(tapete_balcao);
tapete_balcao.position.y = 7.7;
var lugar = [];
for (var i=0; i < 8 ; i++)
{
  lugar[i] = lugar_balcao.clone();
  lugar[i].position.y = 0.1;
  lugar[i].position.x = 16 * Math.cos(i*((Math.PI)/4));
  lugar[i].position.z = 16 * Math.sin(i*((Math.PI)/4));
  tapete_balcao.add(lugar[i]);
}

//Pratos
var pratos = [];
var pratos_mesas = [];

// Carrinho
const carrinho = new THREE.Group();
var geometria_base_carrinho = new THREE.BoxGeometry(12,3,5.5);
var material_base_carrinho = new THREE.MeshStandardMaterial({color: 0x000f0f});
var base_carrinho = new THREE.Mesh(geometria_base_carrinho, material_base_carrinho);
base_carrinho.castShadow = true;
base_carrinho.receiveShadow = true;
carrinho.add(base_carrinho);
base_carrinho.position.y = 5.7;
var geometria_ligacao = new THREE.TorusGeometry(1,0.5,15,35);
var ligacao = new THREE.Mesh(geometria_ligacao, material_base_carrinho);
//ligacao.castShadow = true;
//ligacao.receiveShadow = true;
ligacao.position.set(-5,-2.5,2);
base_carrinho.add(ligacao.clone());
ligacao.position.set(-5,-2.5,-2);
base_carrinho.add(ligacao.clone());
ligacao.position.set(5,-2.5,2);
base_carrinho.add(ligacao.clone());
ligacao.position.set(5,-2.5,-2);
base_carrinho.add(ligacao.clone());
var geometria_barra = new THREE.CylinderGeometry(1,1,9.5,15);
var material_barras = new THREE.MeshStandardMaterial({color: 0xa6a6a6});
var barra = new THREE.Mesh(geometria_barra, material_barras);
barra.castShadow = true;
barra.receiveShadow = true;
barra.rotation.x = -Math.PI / 2;
base_carrinho.add(barra);
barra.position.set(5,-2.5,0);
var geometria_jantes = new THREE.ConeGeometry(1.5,1.5,5,1);
var material_jantes = new THREE.MeshStandardMaterial({color: 0x000000});
var jante = new THREE.Mesh(geometria_jantes, material_jantes);
//jante.castShadow = true;
//jante.receiveShadow = true;
barra.add(jante);
jante.position.y = -4.3;
var geometria_jantes_in = new THREE.ConeGeometry(1.5,1.5,5,1);
var jante2 = new THREE.Mesh(geometria_jantes_in, material_barras);
jante2.rotation.z = Math.PI;
jante.add(jante2);
jante2.position.y = -1;
var jante3 = jante.clone();
jante3.rotation.z = Math.PI;
barra.add(jante3);
jante3.position.y = 4.3;
var geometria_rodas = new THREE.TorusGeometry(2,1,15,20);
var material_rodas = new THREE.MeshStandardMaterial({color: 0x252625});
var roda = new THREE.Mesh(geometria_rodas, material_rodas);
roda.castShadow = true;
roda.receiveShadow = true;
roda.rotation.x = -Math.PI / 2;
var roda2 = roda.clone();
barra.add(roda);
barra.add(roda2);
roda.position.y = -4;
roda2.position.y = 4;
var barra2 = barra.clone();
base_carrinho.add(barra2);
barra2.position.set(-5,-2.5,0);
var lugar_carrinho = lugar_balcao.clone();
base_carrinho.add(lugar_carrinho);
lugar_carrinho.position.y = 1.5;
var geometria_meio_carrinho = new THREE.BoxGeometry(15,0.5,9);
var material_meio_carrinho = new THREE.MeshStandardMaterial({color: 0xba8c41});
var meio_carrinho = new THREE.Mesh(geometria_meio_carrinho, material_meio_carrinho);
meio_carrinho.castShadow = true;
meio_carrinho.receiveShadow = true;
base_carrinho.add(meio_carrinho);
meio_carrinho.position.y = 1;
if(colisao_carrinho)
  collidableMeshList.push(meio_carrinho);
var geometria_hastes_carrinho = new THREE.CylinderGeometry(0.5,0.5,10,4);
var material_hastes_carrinho = new THREE.MeshStandardMaterial({color: 0xa6a6a6});
var hastes_carrinho = new THREE.Mesh(geometria_hastes_carrinho, material_hastes_carrinho);
hastes_carrinho.castShadow = true;
hastes_carrinho.receiveShadow = true;
hastes_carrinho.position.y = 5;
hastes_carrinho.position.x = 6.5;
hastes_carrinho.position.z = 3.5;
meio_carrinho.add(hastes_carrinho.clone());
hastes_carrinho.position.x = -6.5;
meio_carrinho.add(hastes_carrinho.clone());
hastes_carrinho.position.z = -3.5;
meio_carrinho.add(hastes_carrinho.clone());
hastes_carrinho.position.x = 6.5;
meio_carrinho.add(hastes_carrinho.clone());
var textura_topo_carrinho =  new THREE.TextureLoader().load('./Imagens/Rainbow_Flag.png');
var topo_carrinho = new THREE.Mesh(geometria_meio_carrinho, new THREE.MeshStandardMaterial({color: 0xffffff, map: textura_topo_carrinho}));
topo_carrinho.castShadow = true;
//topo_carrinho.receiveShadow = true;
meio_carrinho.add(topo_carrinho);
topo_carrinho.position.y = 10;
base_carrinho.rotation.y = -Math.PI / 2;
carrinho.position.z = 30;
var geometria_farol = new THREE.ConeGeometry(1,4,16);
var farol_carrinho = new THREE.Mesh(geometria_farol, material_hastes_carrinho);
farol_carrinho.castShadow = true;
farol_carrinho.receiveShadow = true;
base_carrinho.add(farol_carrinho);
farol_carrinho.rotation.z = Math.PI / 2;
farol_carrinho.position.x = 6;
//var farol_target = new THREE.Mesh(new THREE.BoxGeometry(0.0001, 0.0001, 0.0001), new THREE.MeshBasicMaterial({color: 0xffffff}));
//farol_carrinho.add(farol_target);
//farol_target.position.z = 2;
//var vec_pos = new THREE.Vector3();
//farol_carrinho.getWorldPosition(vec_pos);
//var luz_farol = new THREE.SpotLight(0xffffff, 1, 18, Math.PI/5);
//luz_farol.position.set(vec_pos.x,vec_pos.y+5,vec_pos.z+10);
//luz_farol.target=farol_target;
//luz_farol.castShadow = true;
//luz_farol.shadow.bias = -0.001;
//luz_farol.shadow.mapSize.width = 4096;
//luz_farol.shadow.mapSize.height = 4096;
//luz_farol.shadow.camera.near = 0.1;
//luz_farol.shadow.camera.far = 500.0;
//luz_farol.shadow.camera.left = 110;
//luz_farol.shadow.camera.right = -110;
//luz_farol.shadow.camera.top = 110;
//luz_farol.shadow.camera.bottom = -110;

// Relógio
const relogio = new THREE.Group();
var geometria_base_relogio = new THREE.BoxGeometry(6,5,6);
var material_base_relogio = new THREE.MeshStandardMaterial({color: 0x1c0c01});
var base_relogio = new THREE.Mesh(geometria_base_relogio, material_base_relogio);
base_relogio.castShadow = true;
base_relogio.receiveShadow = true;
relogio.add(base_relogio);
base_relogio.position.y = 2.5;
var geometria_base2_relogio = new THREE.ConeGeometry(3.5,8,4);
var base2_relogio = new THREE.Mesh(geometria_base2_relogio, material_base_relogio);
base2_relogio.castShadow = true;
base2_relogio.receiveShadow = true;
base_relogio.add(base2_relogio);
base2_relogio.rotation.y = Math.PI / 4;
base2_relogio.position.y = 6.5;
var geometria_meio_relogio = new THREE.BoxGeometry(1,15,4);
var material_meio_relogio = new THREE.MeshStandardMaterial({color: 0x3b1c06});
var meio_relogio = new THREE.Mesh(geometria_meio_relogio, material_meio_relogio);
meio_relogio.castShadow = true;
meio_relogio.receiveShadow = true;
meio_relogio.position.y = 10;
meio_relogio.position.x = 1.5;
base_relogio.add(meio_relogio.clone());
meio_relogio.position.x = -1.5;
base_relogio.add(meio_relogio.clone());
meio_relogio.position.x = 0;
meio_relogio.rotation.y = Math.PI / 2;
base_relogio.add(meio_relogio);
var geometria_topo_relogio = new THREE.BoxGeometry(5,2,5);
var topo_relogio = new THREE.Mesh(geometria_topo_relogio, material_base_relogio);
topo_relogio.castShadow = true;
topo_relogio.receiveShadow = true;
meio_relogio.add(topo_relogio);
topo_relogio.position.y = 8.5;
var geometria_ligacao_relogio = new THREE.CylinderGeometry(0.5,0.5,5,15);
var material_ligacao_relogio = new THREE.MeshStandardMaterial({color: 0x0f0701});
var ligacao_relogio = new THREE.Mesh(geometria_ligacao_relogio, material_ligacao_relogio);
ligacao_relogio.castShadow = true;
ligacao_relogio.receiveShadow = true;
meio_relogio.add(ligacao_relogio);
ligacao_relogio.position.y = 6;
ligacao_relogio.rotation.z = Math.PI / 2;
var geometria_pendulo_relogio = new THREE.BoxGeometry(0.1,9,0.5);
var material_pendulo_relogio = new THREE.MeshStandardMaterial({color: 0x856e5e});
var pendulo_relogio = new THREE.Mesh(geometria_pendulo_relogio, material_pendulo_relogio);
pendulo_relogio.castShadow = true;
pendulo_relogio.receiveShadow = true;
pendulo_relogio.rotation.z = Math.PI / 2;
pendulo_relogio.position.y = 2.5;
pendulo_relogio.position.x = -4;
var geometria_ppendulo_relogio = new THREE.CylinderGeometry(1,1,0.2,15);
var ppendulo_relogio = new THREE.Mesh(geometria_ppendulo_relogio, material_ligacao_relogio);
ppendulo_relogio.castShadow = true;
ppendulo_relogio.receiveShadow = true;
pendulo_relogio.add(ppendulo_relogio);
ppendulo_relogio.position.y = 4.5;
ppendulo_relogio.rotation.z = Math.PI / 2;
ligacao_relogio.add(pendulo_relogio.clone());
pendulo_relogio.position.y = -2.5;
ligacao_relogio.add(pendulo_relogio);

var sentido_pendulo = false;

// Texto com temporizador - Ainda não está a funcionar
var texto_temp = fazTexto( " 00:00 ", { fontsize: 24, borderColor: {r:255, g:0, b:0, a:1.0}, backgroundColor: {r:255, g:100, b:100, a:0.8} } );

/////////////
// FUNÇÔES //
/////////////

function OnWindowResize()
{
  camara_perspetiva.aspect = (window.innerWidth - 15) / (window.innerHeight - 15);
  camara_perspetiva.updateProjectionMatrix();

  camara_ortografica.left = -(window.innerWidth/window.innerHeight)*alcance_camara_orto;
  camara_ortografica.right = (window.innerWidth/window.innerHeight)*alcance_camara_orto;
  camara_ortografica.updateProjectionMatrix();

  renderer.setSize(window.innerWidth - 15, window.innerHeight - 15);
}

function CarregaColisaoMesas()
{
  for (let i = 0 ; i < 8 ; i ++)
  {
    outlineMesh[i] = outlineMeshTrans.clone()
    mesas_array[i].add(outlineMesh[i]);
    collidableMeshList.push(outlineMesh[i]);
  }
}

function CarregarPratos()
{
  const loader = new GLTFLoader();
  for (let i = 0 ; i < nr_pratos ; i ++)
  {
    loader.load(('./Objetos/Pratos/' + i + '/scene.gltf'), function(prato) {
    prato.scene.traverse(c => {
      c.castShadow = true;
      c.receiveShadow = true;
    })
    prato.scene.scale.setScalar(0.3);
    pratos[i] = prato.scene;
    pratos_mesas[i] = pratos[i].clone();
    pratos_mesas[i].scale.setScalar(0.5);
    pratos_mesas[i].scale.z = 0.001;
    pratos_mesas[i].rotation.x = -Math.PI / 2;
    mesas_array[i].add(pratos_mesas[i]);
    pratos_mesas[i].position.y = altura_mesas+(altura_mesas/20)+0.001;
    outlineMesh[i] = outlineMesh1.clone()
    mesas_array[i].add( outlineMesh[i] );
    mesas_em_falta ++;
    lugar[i].add(pratos[i]);
    });
  }
}

function distancia(mesh1, mesh2)
{ 
  var vec1 = new THREE.Vector3();
  var vec2 = new THREE.Vector3();
  mesh1.getWorldPosition(vec1);
  mesh2.getWorldPosition(vec2);
  var dx = vec1.x - vec2.x; 
  var dy = vec1.y - vec2.y; 
  var dz = vec1.z - vec2.z; 
  return Math.sqrt(dx*dx+dy*dy+dz*dz); 
}

function pegaPrato()
{
  for (var i = 0 ; i < pratos.length ; i++)
  {
    if (distancia(boneco, pratos[i]) < 12)
    {
      prato_atual = pratos[i];
      boneco.add(prato_atual);
      pratos[i].scale.setScalar(3);
      pratos[i].position.y = 120;
      pratos[i].position.z = 30;
      for (var i = 0 ; i < mesas_array.length ; i++)
      {
        if (distancia(prato_atual, mesas_array[i]) < 20)
        {
          if ( prato_atual == pratos[i] ) {
            mesas_array[i].add( outlineMesh[i] );
            mesas_em_falta ++;
          }
        }
      }
      break;
    }
  }
}

function largaPrato()
{
  if (distancia(prato_atual, topo_balcao) < 23) {
    for (var i = 0 ; i < lugar.length ; i++)
    {
      if (distancia(prato_atual, lugar[i]) < 9)
      {
        var lugar_ocupado = false;
        for (var j = 0 ; j < pratos.length ; j++)
        {
          if (distancia(pratos[j], lugar[i]) < 5)
          {
            lugar_ocupado = true;
            break;
          }
        }
        if (!lugar_ocupado)
        {
          lugar[i].add(prato_atual);
          prato_atual.scale.setScalar(0.3);
          prato_atual.position.x = 0;
          prato_atual.position.y = 0;
          prato_atual.position.z = 0;
          prato_atual = null;
          break;
        }
      }
    }
  }
  else {
    for (var i = 0 ; i < mesas_array.length ; i++)
    {
      if (distancia(prato_atual, mesas_array[i]) < 20)
      {
        var mesa_ocupada = false;
        for (var j = 0 ; j < pratos.length ; j++)
        {
          if (distancia(pratos[j], mesas_array[i]) < 10)
          {
            mesa_ocupada = true;
            break;
          }
        }
        if (!mesa_ocupada)
        {
          mesas_array[i].add(prato_atual);
          if ( prato_atual == pratos[i] ) {
            mesas_array[i].remove( outlineMesh[i] );
            mesas_em_falta --;
            verificaGanho();
          }
          prato_atual.scale.setScalar(0.3);
          prato_atual.position.y = altura_mesas+(altura_mesas/20);
          prato_atual.position.z = 0;
          prato_atual = null;
          break;
        }
      }
    }
  }
}

function apanhaPrato()
{
  if (distancia(boneco, lugar_carrinho) < 10) {
    var lugar_ocupado = false;
    for (var j = 0 ; j < pratos.length ; j++)
    {
      if (distancia(pratos[j], lugar_carrinho) < 5)
      {
        lugar_ocupado = true;
        break;
      }
    }
    if (!lugar_ocupado)
    {
      lugar_carrinho.add(prato_atual);
      prato_atual.scale.setScalar(0.3);
      prato_atual.position.x = 0;
      prato_atual.position.y = 0;
      prato_atual.position.z = 0;
      prato_atual = null;
      teclas.espaco = true;
    }
  }
}

function iniciaJogo()
{
  clearInterval(cron);
  cron = setInterval(temporizador, 1000);
}

function pausaJogo()
{
  if(jogo_iniciado)
  {
    clearInterval(cron);
    if(pausa.className == "")
    {
      jogo_em_pausa = true;
      pausa.className = "abrir";
    }
    else
    {
      jogo_em_pausa = false;
      pausa.className = "";
    }
  }
}

function recomecaJogo()
{
  //jogo_em_pausa = true;
  //jogo_iniciado = false;
  pausa.className = "";
  inicio.className = "";
  minute = 0;
  second = 0;
  millisecond = 0;

  mesas_em_falta = 0;

  boneco.position.set(0,0,-30);
  carrinho.position.set(0,0,30);
  for (let i = 0 ; i < nr_pratos ; i ++)
  {
    mesas_array[i].remove( outlineMesh[i] );
    mesas_array[i].remove(pratos_mesas[i]);
    mesas_array[i].remove(pratos[i]);
    //lugar[i].remove(pratos[i]);
    lugar[i].children = [];
    boneco.remove(prato_atual);
  }

  prato_atual = null;
  teclas.espaco = true;

  CarregarPratos();

  jogo_em_pausa = false;
  jogo_iniciado = true;
}

function verificaGanho()
{
  if (mesas_em_falta == 0)
  {
    jogo_em_pausa = true;
    jogo_iniciado = false;
    ganhou.className = "abrir";
  }
}

function fazTexto( texto, parametros )
{
	if ( parametros === undefined ) parametros = {};
	
	var fontface = parametros.hasOwnProperty("fontface") ? 
		parametros["fontface"] : "Arial";
	
	var fontsize = parametros.hasOwnProperty("fontsize") ? 
		parametros["fontsize"] : 18;
	
	var borderThickness = parametros.hasOwnProperty("borderThickness") ? 
		parametros["borderThickness"] : 4;
	
	var borderColor = parametros.hasOwnProperty("borderColor") ?
		parametros["borderColor"] : { r:0, g:0, b:0, a:1.0 };
	
	var backgroundColor = parametros.hasOwnProperty("backgroundColor") ?
		parametros["backgroundColor"] : { r:255, g:255, b:255, a:1.0 };

	var spriteAlignment = new THREE.Vector2( 1, -1 );
		
	var canvas = document.createElement('canvas');
	var context = canvas.getContext('2d');
	context.font = "Bold " + fontsize + "px " + fontface;
    
	var metrics = context.measureText( texto );
	var textWidth = metrics.width;
	
	// background color
	context.fillStyle = "rgba(" + backgroundColor.r + "," + backgroundColor.g + "," + backgroundColor.b + "," + backgroundColor.a + ")";
	// border color
	context.strokeStyle = "rgba(" + borderColor.r + "," + borderColor.g + "," + borderColor.b + "," + borderColor.a + ")";

	context.lineWidth = borderThickness;
	roundRect(context, borderThickness/2, borderThickness/2, textWidth + borderThickness, fontsize * 1.4 + borderThickness, 6);
	
	// text color
	context.fillStyle = "rgba(0, 0, 0, 1.0)";

	context.fillText( texto, borderThickness, fontsize + borderThickness);
	
	// canvas contents will be used for a texture
	var texture = new THREE.Texture(canvas) 
	texture.needsUpdate = true;

	var spriteMaterial = new THREE.SpriteMaterial( 
		{ map: texture } );
	var sprite = new THREE.Sprite( spriteMaterial );
	sprite.scale.set(10,5,0);

  //sprite.position.set(0,17,-30);

	return sprite;	
}

// função para desenhar retangulos arrendondados
function roundRect(ctx, x, y, w, h, r) 
{
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
  ctx.fill();
	ctx.stroke();   
}

//let time = 10 * 60;

function temporizador() {
  const minutes = Math.floor(time /60);
  let seconds = time % 60;

  seconds = seconds < 10 ? '0' + seconds : seconds;

  minute = minutes;
  second = seconds;
  time -- ;
  /*
  if ((millisecond += 10) == 1000) {
    millisecond = 0;
    second++;
  }
  if (second == 60) {
    second = 0;
    minute++;
  }*/
}