import {describe,it,expect} from 'vitest'
import {deploymentBase} from '../../vite.config'

describe('GitHub Pages deployment base',()=>{
  it('defaults to the planned project path without an account',()=>expect(deploymentBase()).toBe('/beforeshare/'))
  it('uses the actual project repository name',()=>expect(deploymentBase('example/other-repo')).toBe('/other-repo/'))
  it('uses the root for an owner Pages repository',()=>expect(deploymentBase('Example/example.github.io')).toBe('/'))
})
